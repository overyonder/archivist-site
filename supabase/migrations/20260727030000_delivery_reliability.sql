-- Bound delivery retries, record Resend's complete delivery lifecycle, and
-- invoke the protected reconciler on a durable database-owned schedule.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

alter table public.deliveries
    drop constraint deliveries_status_check;

alter table public.deliveries
    add constraint deliveries_status_check check (
        status in (
            'queued',
            'sending',
            'accepted',
            'delivered',
            'failed',
            'dead_letter',
            'suppressed'
        )
    );

alter table public.delivery_events
    drop constraint delivery_events_kind_check;

alter table public.delivery_events
    add constraint delivery_events_kind_check check (
        kind in (
            'send',
            'delivery',
            'delivery_delayed',
            'bounce',
            'complaint',
            'reject',
            'suppression',
            'open',
            'click',
            'rendering_failure',
            'preference_change'
        )
    );

alter table public.suppressions
    drop constraint suppressions_reason_check;

alter table public.suppressions
    add constraint suppressions_reason_check check (
        reason in (
            'hard_bounce',
            'complaint',
            'provider_suppression',
            'administrative'
        )
    );

create function public.apply_delivery_retry_policy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    max_attempts constant integer := 5;
    delay_minutes integer;
begin
    if new.status <> 'failed' then
        return new;
    end if;

    new.claimed_at := null;
    new.claim_expires_at := null;
    new.claim_token := null;

    if new.attempt_count >= max_attempts then
        new.status := 'dead_letter';
        return new;
    end if;

    delay_minutes := least(
        1440,
        15 * power(2, greatest(new.attempt_count - 1, 0))::integer
    );
    new.next_attempt_at := greatest(
        new.next_attempt_at,
        now() + make_interval(mins => delay_minutes)
    );
    return new;
end;
$$;

create trigger deliveries_apply_retry_policy
before update on public.deliveries
for each row execute function public.apply_delivery_retry_policy();

update public.deliveries
set status = 'dead_letter',
    claimed_at = null,
    claim_expires_at = null,
    claim_token = null
where status in ('queued', 'sending', 'failed')
  and attempt_count >= 5;

create or replace function public.claim_deliveries(
    p_limit integer,
    p_lease interval default interval '5 minutes'
)
returns setof public.deliveries
language sql
security definer
set search_path = ''
as $$
    with claimable as (
        select deliveries.id
        from public.deliveries
        where (
                status in ('queued', 'failed')
                or (status = 'sending' and claim_expires_at <= now())
            )
          and attempt_count < 5
          and next_attempt_at <= now()
          and not exists (
              select 1
              from public.suppressions
              where suppressions.contact_id = deliveries.contact_id
                and cleared_at is null
                and scope in ('archivist', 'all')
          )
          and (
              (
                  kind = 'confirmation'
                  and exists (
                      select 1
                      from public.action_tokens
                      where action_tokens.id = deliveries.action_token_id
                        and purpose = 'confirm'
                        and consumed_at is null
                        and expires_at > now()
                  )
              )
              or (
                  kind = 'early_access_update'
                  and exists (
                      select 1
                      from public.early_access_memberships
                      where early_access_memberships.contact_id =
                            deliveries.contact_id
                        and status = 'confirmed'
                  )
                  and exists (
                      select 1
                      from public.email_contact_preferences
                      where email_contact_preferences.contact_id =
                            deliveries.contact_id
                        and topic_name = 'archivist-early-access'
                        and desired_status = 'OPT_IN'
                        and observed_status = 'OPT_IN'
                        and sync_status = 'synced'
                  )
              )
          )
        order by next_attempt_at, queued_at
        for update skip locked
        limit greatest(p_limit, 0)
    )
    update public.deliveries
    set status = 'sending',
        claimed_at = now(),
        claim_expires_at = now() + p_lease,
        claim_token = gen_random_uuid(),
        attempt_count = attempt_count + 1,
        attempted_at = now()
    from claimable
    where deliveries.id = claimable.id
    returning deliveries.*;
$$;

create or replace function public.claim_confirmation_deliveries(
    p_limit integer,
    p_lease interval default interval '5 minutes'
)
returns setof public.deliveries
language sql
security definer
set search_path = ''
as $$
    with claimable as (
        select deliveries.id
        from public.deliveries
        where kind = 'confirmation'
          and (
              status in ('queued', 'failed')
              or (status = 'sending' and claim_expires_at <= now())
          )
          and attempt_count < 5
          and next_attempt_at <= now()
          and exists (
              select 1
              from public.action_tokens
              where action_tokens.id = deliveries.action_token_id
                and purpose = 'confirm'
                and consumed_at is null
                and expires_at > now()
          )
          and not exists (
              select 1
              from public.suppressions
              where suppressions.contact_id = deliveries.contact_id
                and cleared_at is null
                and scope in ('archivist', 'all')
          )
        order by next_attempt_at, queued_at
        for update skip locked
        limit greatest(p_limit, 0)
    )
    update public.deliveries
    set status = 'sending',
        claimed_at = now(),
        claim_expires_at = now() + p_lease,
        claim_token = gen_random_uuid(),
        attempt_count = attempt_count + 1,
        attempted_at = now()
    from claimable
    where deliveries.id = claimable.id
    returning deliveries.*;
$$;

create or replace function public.record_delivery_event(
    p_provider_event_id text,
    p_provider_message_id text,
    p_delivery_id uuid,
    p_kind text,
    p_payload jsonb,
    p_occurred_at timestamptz,
    p_hard_bounce boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_delivery_id uuid;
    v_contact_id uuid;
    v_reason text;
    v_inserted integer;
begin
    select id, contact_id into v_delivery_id, v_contact_id
    from public.deliveries
    where provider_message_id = p_provider_message_id
       or id = p_delivery_id
    for update;

    if not found then
        raise exception 'Provider message is not correlated yet'
            using errcode = '40001';
    end if;

    update public.deliveries
    set provider_message_id = coalesce(
        provider_message_id,
        p_provider_message_id
    )
    where id = v_delivery_id;

    insert into public.delivery_events (
        provider_event_id,
        provider_message_id,
        delivery_id,
        contact_id,
        kind,
        payload,
        occurred_at
    ) values (
        p_provider_event_id,
        p_provider_message_id,
        v_delivery_id,
        v_contact_id,
        p_kind,
        p_payload,
        p_occurred_at
    )
    on conflict (provider_event_id) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
        return false;
    end if;

    update public.deliveries
    set status = case
            when p_kind = 'suppression' then 'suppressed'
            when p_kind = 'complaint' then 'suppressed'
            when p_kind = 'bounce' and p_hard_bounce then 'suppressed'
            when p_kind = 'delivery'
              and status not in ('suppressed', 'dead_letter')
                then 'delivered'
            when p_kind = 'send'
              and status in ('queued', 'sending')
                then 'accepted'
            when p_kind in ('bounce', 'reject', 'rendering_failure')
              and status not in ('delivered', 'suppressed', 'dead_letter')
                then 'failed'
            else status
        end,
        accepted_at = case
            when p_kind = 'send' then coalesce(accepted_at, p_occurred_at)
            else accepted_at
        end,
        delivered_at = case
            when p_kind = 'delivery' then coalesce(delivered_at, p_occurred_at)
            else delivered_at
        end,
        failure_class = case
            when p_kind in ('complaint', 'suppression')
                or (p_kind = 'bounce' and p_hard_bounce)
                then 'suppressed'
            when p_kind = 'bounce' then 'transient'
            when p_kind in ('reject', 'rendering_failure') then 'permanent'
            else failure_class
        end,
        failure_code = case
            when p_kind in (
                'bounce',
                'complaint',
                'reject',
                'rendering_failure',
                'suppression'
            ) then p_kind
            else failure_code
        end,
        failure_reason = case
            when p_kind in (
                'bounce',
                'complaint',
                'reject',
                'rendering_failure',
                'suppression'
            ) then p_payload::text
            else failure_reason
        end,
        claimed_at = null,
        claim_expires_at = null,
        claim_token = null
    where id = v_delivery_id;

    if p_kind = 'send' then
        update public.delivery_attempts
        set completed_at = coalesce(completed_at, p_occurred_at),
            outcome = coalesce(outcome, 'accepted'),
            provider_message_id = coalesce(
                provider_message_id,
                p_provider_message_id
            )
        where id = (
            select id
            from public.delivery_attempts
            where delivery_id = v_delivery_id
              and completed_at is null
            order by attempt_number desc
            limit 1
        );
    end if;

    v_reason := case
        when p_kind = 'complaint' then 'complaint'
        when p_kind = 'suppression' then 'provider_suppression'
        when p_kind = 'bounce' and p_hard_bounce then 'hard_bounce'
        else null
    end;

    if v_reason is not null then
        insert into public.suppressions (
            contact_id,
            reason,
            scope,
            source,
            source_event_id
        ) values (
            v_contact_id,
            v_reason,
            'archivist',
            'email_provider',
            p_provider_event_id
        )
        on conflict (contact_id, scope, reason)
            where cleared_at is null
            do nothing;

        insert into public.email_contact_preferences (
            contact_id,
            topic_name,
            desired_status,
            sync_status
        ) values (
            v_contact_id,
            'archivist-early-access',
            'OPT_OUT',
            'pending'
        )
        on conflict (contact_id, topic_name) do update set
            desired_status = 'OPT_OUT',
            sync_status = 'pending',
            synchronized_at = null,
            failure_reason = null;
    end if;

    return true;
end;
$$;

revoke execute on function public.apply_delivery_retry_policy()
from public, anon, authenticated;

create function public.invoke_early_access_reconciler()
returns bigint
language sql
security definer
set search_path = ''
as $$
    select net.http_post(
        url := 'https://xbwhevdunxftierqlpsr.supabase.co/functions/v1/reconcile-early-access',
        headers := jsonb_build_object(
            'Content-Type',
            'application/json',
            'x-internal-secret',
            (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'archivist_reconciler_internal_secret'
                limit 1
            )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
$$;

revoke execute on function public.invoke_early_access_reconciler()
from public, anon, authenticated;

select cron.schedule(
    'archivist-reconcile-early-access',
    '*/5 * * * *',
    'select public.invoke_early_access_reconciler();'
)
where not exists (
    select 1
    from cron.job
    where jobname = 'archivist-reconcile-early-access'
);

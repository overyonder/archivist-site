create or replace function public.confirm_early_access(p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_token public.action_tokens%rowtype;
    v_email public.citext;
begin
    select * into v_token
    from public.action_tokens
    where token_hash = p_token_hash
      and purpose = 'confirm'
      and consumed_at is null
      and expires_at > now()
    for update;

    if not found then
        return jsonb_build_object('outcome', 'invalid');
    end if;

    if exists (
        select 1
        from public.suppressions
        where suppressions.contact_id = v_token.contact_id
          and cleared_at is null
          and scope in ('archivist', 'all')
    ) then
        update public.action_tokens set consumed_at = now() where id = v_token.id;
        return jsonb_build_object('outcome', 'suppressed');
    end if;

    select email into v_email
    from public.contacts
    where id = v_token.contact_id;

    update public.action_tokens set consumed_at = now() where id = v_token.id;

    update public.early_access_memberships
    set status = 'confirmed', confirmed_at = now(), left_at = null
    where contact_id = v_token.contact_id;

    insert into public.consent_events (
        contact_id, email_snapshot, kind, source
    ) values (
        v_token.contact_id, v_email, 'confirmed', 'confirmation_link'
    );

    insert into public.email_contact_preferences (
        contact_id, topic_name, desired_status, sync_status
    ) values (
        v_token.contact_id, 'archivist-early-access', 'OPT_IN', 'pending'
    )
    on conflict (contact_id, topic_name) do update set
        desired_status = 'OPT_IN',
        sync_status = 'pending',
        synchronized_at = null,
        failure_reason = null;

    return jsonb_build_object(
        'outcome', 'confirmed',
        'contact_id', v_token.contact_id,
        'email', v_email::text
    );
end;
$$;

create or replace function public.leave_early_access(
    p_token_hash bytea,
    p_source text default 'removal_link'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_token public.action_tokens%rowtype;
    v_email public.citext;
begin
    select * into v_token
    from public.action_tokens
    where token_hash = p_token_hash
      and purpose = 'leave'
      and consumed_at is null
      and expires_at > now()
    for update;

    if not found then
        return jsonb_build_object('outcome', 'invalid');
    end if;

    select email into v_email from public.contacts where id = v_token.contact_id;
    update public.action_tokens set consumed_at = now() where id = v_token.id;

    update public.early_access_memberships
    set status = 'left', left_at = now()
    where contact_id = v_token.contact_id and status = 'confirmed';

    if not found then
        return jsonb_build_object('outcome', 'not_confirmed');
    end if;

    insert into public.consent_events (contact_id, email_snapshot, kind, source)
    values (v_token.contact_id, v_email, 'left', p_source);

    insert into public.email_contact_preferences (
        contact_id, topic_name, desired_status, sync_status
    ) values (
        v_token.contact_id, 'archivist-early-access', 'OPT_OUT', 'pending'
    )
    on conflict (contact_id, topic_name) do update set
        desired_status = 'OPT_OUT',
        sync_status = 'pending',
        synchronized_at = null,
        failure_reason = null;

    return jsonb_build_object(
        'outcome', 'left',
        'contact_id', v_token.contact_id,
        'email', v_email::text
    );
end;
$$;

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
                      where early_access_memberships.contact_id = deliveries.contact_id
                        and status = 'confirmed'
                  )
                  and exists (
                      select 1
                      from public.email_contact_preferences
                      where email_contact_preferences.contact_id = deliveries.contact_id
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

create or replace function public.apply_ses_preference_event(
    p_email text,
    p_status text,
    p_provider_event_id text,
    p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_contact_id uuid;
    v_email public.citext;
    v_left boolean := false;
begin
    if p_status not in ('OPT_IN', 'OPT_OUT') then
        raise exception 'invalid SES preference status' using errcode = '22023';
    end if;

    select id, email into v_contact_id, v_email
    from public.contacts
    where email = lower(trim(p_email))::public.citext;

    if not found then
        return false;
    end if;

    if p_status = 'OPT_OUT' then
        update public.early_access_memberships
        set status = 'left', left_at = p_occurred_at
        where contact_id = v_contact_id and status = 'confirmed';
        v_left := found;

        insert into public.email_contact_preferences (
            contact_id,
            topic_name,
            desired_status,
            observed_status,
            sync_status,
            last_attempted_at,
            synchronized_at
        ) values (
            v_contact_id,
            'archivist-early-access',
            'OPT_OUT',
            'OPT_OUT',
            'synced',
            p_occurred_at,
            p_occurred_at
        )
        on conflict (contact_id, topic_name) do update set
            desired_status = 'OPT_OUT',
            observed_status = 'OPT_OUT',
            sync_status = 'synced',
            last_attempted_at = p_occurred_at,
            synchronized_at = p_occurred_at,
            failure_reason = null;

        if v_left then
            insert into public.consent_events (
                contact_id, email_snapshot, kind, source, metadata, occurred_at
            ) values (
                v_contact_id,
                v_email,
                'left',
                'ses_subscription_event',
                jsonb_build_object('provider_event_id', p_provider_event_id),
                p_occurred_at
            );
        end if;
    else
        update public.email_contact_preferences
        set observed_status = 'OPT_IN',
            sync_status = case
                when desired_status = 'OPT_IN' then 'synced'
                else 'pending'
            end,
            last_attempted_at = p_occurred_at,
            synchronized_at = case
                when desired_status = 'OPT_IN' then p_occurred_at
                else null
            end,
            failure_reason = null
        where contact_id = v_contact_id
          and topic_name = 'archivist-early-access';
    end if;

    return true;
end;
$$;

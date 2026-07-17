create extension if not exists citext;

create table public.contacts (
    id uuid primary key default gen_random_uuid(),
    email citext not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint contacts_email_normalized check (email::text = lower(trim(email::text)))
);

create table public.early_access_memberships (
    contact_id uuid primary key references public.contacts(id) on delete restrict,
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'left')),
    requested_at timestamptz not null default now(),
    confirmed_at timestamptz,
    left_at timestamptz,
    updated_at timestamptz not null default now(),
    constraint membership_state_consistent check (
        (status = 'pending' and confirmed_at is null and left_at is null)
        or (status = 'confirmed' and confirmed_at is not null and left_at is null)
        or (status = 'left' and confirmed_at is not null and left_at is not null)
    )
);

create table public.consent_events (
    id bigint generated always as identity primary key,
    contact_id uuid not null references public.contacts(id) on delete restrict,
    email_snapshot citext not null,
    kind text not null check (
        kind in (
            'join_requested',
            'rejoin_requested',
            'confirmed',
            'left',
            'suppression_cleared'
        )
    ),
    source text not null,
    form_version text,
    policy_version text,
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now()
);

create index consent_events_contact_time_idx
    on public.consent_events (contact_id, occurred_at desc);

create table public.action_tokens (
    id uuid primary key default gen_random_uuid(),
    contact_id uuid not null references public.contacts(id) on delete restrict,
    purpose text not null check (purpose in ('confirm', 'leave')),
    token_hash bytea not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint token_expiry_after_creation check (expires_at > created_at),
    constraint token_consumption_after_creation check (
        consumed_at is null or consumed_at >= created_at
    )
);

create index action_tokens_active_contact_idx
    on public.action_tokens (contact_id, purpose, expires_at)
    where consumed_at is null;

create table public.suppressions (
    id uuid primary key default gen_random_uuid(),
    contact_id uuid not null references public.contacts(id) on delete restrict,
    reason text not null check (
        reason in ('hard_bounce', 'complaint', 'administrative')
    ),
    scope text not null default 'archivist'
        check (scope in ('archivist', 'all')),
    source text not null,
    source_event_id text,
    created_at timestamptz not null default now(),
    cleared_at timestamptz,
    cleared_by text,
    clearance_reason text,
    constraint suppression_clearance_consistent check (
        (cleared_at is null and cleared_by is null and clearance_reason is null)
        or
        (
            cleared_at is not null
            and cleared_at >= created_at
            and cleared_by is not null
            and clearance_reason is not null
        )
    )
);

create unique index suppressions_active_reason_idx
    on public.suppressions (contact_id, scope, reason)
    where cleared_at is null;

create unique index suppressions_source_event_idx
    on public.suppressions (source_event_id)
    where source_event_id is not null;

create table public.ses_contact_preferences (
    contact_id uuid not null references public.contacts(id) on delete restrict,
    topic_name text not null,
    desired_status text not null check (desired_status in ('OPT_IN', 'OPT_OUT')),
    observed_status text check (observed_status in ('OPT_IN', 'OPT_OUT')),
    sync_status text not null default 'pending'
        check (sync_status in ('pending', 'synced', 'failed')),
    last_attempted_at timestamptz,
    synchronized_at timestamptz,
    failure_reason text,
    updated_at timestamptz not null default now(),
    primary key (contact_id, topic_name),
    constraint ses_preference_sync_consistent check (
        (sync_status = 'pending' and synchronized_at is null)
        or
        (
            sync_status = 'synced'
            and observed_status = desired_status
            and synchronized_at is not null
            and failure_reason is null
        )
        or
        (sync_status = 'failed' and failure_reason is not null)
    )
);

create index ses_contact_preferences_pending_idx
    on public.ses_contact_preferences (updated_at)
    where sync_status in ('pending', 'failed');

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    subject text not null,
    content_digest text not null,
    source_revision text not null,
    status text not null default 'draft'
        check (status in ('draft', 'queued', 'sending', 'sent', 'cancelled')),
    created_at timestamptz not null default now(),
    queued_at timestamptz,
    completed_at timestamptz
);

create table public.deliveries (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('confirmation', 'early_access_update')),
    message_id uuid references public.messages(id) on delete restrict,
    action_token_id uuid references public.action_tokens(id) on delete restrict,
    contact_id uuid not null references public.contacts(id) on delete restrict,
    status text not null default 'queued'
        check (status in ('queued', 'sending', 'accepted', 'delivered', 'failed', 'suppressed')),
    ses_message_id text unique,
    attempt_count integer not null default 0 check (attempt_count >= 0),
    queued_at timestamptz not null default now(),
    next_attempt_at timestamptz not null default now(),
    claimed_at timestamptz,
    claim_expires_at timestamptz,
    claim_token uuid,
    attempted_at timestamptz,
    accepted_at timestamptz,
    delivered_at timestamptz,
    failure_class text check (failure_class in ('transient', 'permanent', 'suppressed')),
    failure_code text,
    failure_reason text,
    constraint delivery_source_consistent check (
        (kind = 'confirmation' and message_id is null and action_token_id is not null)
        or
        (kind = 'early_access_update' and message_id is not null and action_token_id is null)
    ),
    constraint delivery_claim_consistent check (
        (claimed_at is null and claim_expires_at is null and claim_token is null)
        or
        (
            claimed_at is not null
            and claim_expires_at > claimed_at
            and claim_token is not null
        )
    )
);

create unique index deliveries_update_recipient_idx
    on public.deliveries (message_id, contact_id)
    where kind = 'early_access_update';

create unique index deliveries_confirmation_token_idx
    on public.deliveries (action_token_id)
    where kind = 'confirmation';

create index deliveries_dispatch_idx
    on public.deliveries (next_attempt_at, queued_at)
    where status in ('queued', 'sending', 'failed');

create table public.delivery_attempts (
    id uuid primary key default gen_random_uuid(),
    delivery_id uuid not null references public.deliveries(id) on delete restrict,
    attempt_number integer not null check (attempt_number > 0),
    idempotency_key uuid not null unique,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    outcome text check (outcome in ('accepted', 'transient_failure', 'permanent_failure')),
    ses_message_id text unique,
    failure_code text,
    failure_reason text,
    unique (delivery_id, attempt_number),
    constraint delivery_attempt_completion_consistent check (
        (completed_at is null and outcome is null)
        or (completed_at is not null and completed_at >= started_at and outcome is not null)
    )
);

create table public.delivery_events (
    id bigint generated always as identity primary key,
    provider_event_id text not null unique,
    ses_message_id text,
    delivery_id uuid references public.deliveries(id) on delete set null,
    contact_id uuid references public.contacts(id) on delete set null,
    kind text not null check (
        kind in (
            'send',
            'delivery',
            'bounce',
            'complaint',
            'reject',
            'open',
            'click',
            'rendering_failure',
            'preference_change'
        )
    ),
    payload jsonb not null,
    occurred_at timestamptz not null,
    received_at timestamptz not null default now()
);

create index delivery_events_ses_message_idx
    on public.delivery_events (ses_message_id)
    where ses_message_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create function public.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception '% is append-only', tg_table_name;
end;
$$;

create function public.protect_message_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status <> 'draft' and (
        new.slug,
        new.subject,
        new.content_digest,
        new.source_revision
    ) is distinct from (
        old.slug,
        old.subject,
        old.content_digest,
        old.source_revision
    ) then
        raise exception 'queued message content is immutable';
    end if;

    return new;
end;
$$;

create function public.protect_delivery_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if (
        new.delivery_id,
        new.attempt_number,
        new.idempotency_key,
        new.started_at
    ) is distinct from (
        old.delivery_id,
        old.attempt_number,
        old.idempotency_key,
        old.started_at
    ) then
        raise exception 'delivery attempt identity is immutable';
    end if;

    if old.completed_at is not null and new is distinct from old then
        raise exception 'completed delivery attempt is immutable';
    end if;

    return new;
end;
$$;

create function public.request_early_access(
    p_email text,
    p_token_id uuid,
    p_token_hash bytea,
    p_expires_at timestamptz,
    p_source text,
    p_form_version text,
    p_policy_version text
)
returns table (outcome text, contact_id uuid, token_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_email public.citext := lower(trim(p_email))::public.citext;
    v_contact_id uuid;
    v_token_id uuid;
    v_membership_status text;
begin
    if length(v_email::text) > 254
        or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then
        raise exception 'invalid email address' using errcode = '22023';
    end if;

    insert into public.contacts (email)
    values (v_email)
    on conflict (email) do update set email = excluded.email
    returning id into v_contact_id;

    select status into v_membership_status
    from public.early_access_memberships
    where early_access_memberships.contact_id = v_contact_id;

    insert into public.consent_events (
        contact_id,
        email_snapshot,
        kind,
        source,
        form_version,
        policy_version
    ) values (
        v_contact_id,
        v_email,
        case
            when v_membership_status is null then 'join_requested'
            else 'rejoin_requested'
        end,
        p_source,
        p_form_version,
        p_policy_version
    );

    if exists (
        select 1
        from public.suppressions
        where suppressions.contact_id = v_contact_id
          and cleared_at is null
          and scope in ('archivist', 'all')
    ) then
        return query select 'suppressed'::text, v_contact_id, null::uuid;
        return;
    end if;

    if v_membership_status = 'confirmed' then
        return query select 'already_confirmed'::text, v_contact_id, null::uuid;
        return;
    end if;

    update public.action_tokens
    set consumed_at = now()
    where action_tokens.contact_id = v_contact_id
      and purpose = 'confirm'
      and consumed_at is null;

    insert into public.early_access_memberships (
        contact_id,
        status,
        requested_at,
        confirmed_at,
        left_at
    ) values (
        v_contact_id,
        'pending',
        now(),
        null,
        null
    )
    on conflict on constraint early_access_memberships_pkey do update set
        status = 'pending',
        requested_at = excluded.requested_at,
        confirmed_at = null,
        left_at = null;

    insert into public.action_tokens (id, contact_id, purpose, token_hash, expires_at)
    values (p_token_id, v_contact_id, 'confirm', p_token_hash, p_expires_at)
    returning id into v_token_id;

    return query select 'confirmation_required'::text, v_contact_id, v_token_id;
end;
$$;

create function public.confirm_early_access(p_token_hash bytea)
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

    insert into public.ses_contact_preferences (
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

create function public.leave_early_access(
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

    insert into public.ses_contact_preferences (
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

create function public.claim_deliveries(
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
                      from public.ses_contact_preferences
                      where ses_contact_preferences.contact_id = deliveries.contact_id
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

create function public.claim_confirmation_deliveries(
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

create function public.record_delivery_event(
    p_provider_event_id text,
    p_ses_message_id text,
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
    where ses_message_id = p_ses_message_id
       or id = p_delivery_id
    for update;

    if not found then
        raise exception 'SES message is not correlated yet' using errcode = '40001';
    end if;

    update public.deliveries
    set ses_message_id = coalesce(ses_message_id, p_ses_message_id)
    where id = v_delivery_id;

    insert into public.delivery_events (
        provider_event_id,
        ses_message_id,
        delivery_id,
        contact_id,
        kind,
        payload,
        occurred_at
    ) values (
        p_provider_event_id,
        p_ses_message_id,
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

    if v_delivery_id is not null then
        update public.deliveries
        set status = case
                when p_kind = 'send' then 'accepted'
                when p_kind = 'delivery' then 'delivered'
                when p_kind = 'complaint' then 'suppressed'
                when p_kind = 'bounce' and p_hard_bounce then 'suppressed'
                when p_kind in ('bounce', 'reject', 'rendering_failure') then 'failed'
                else status
            end,
            accepted_at = case when p_kind = 'send' then p_occurred_at else accepted_at end,
            delivered_at = case when p_kind = 'delivery' then p_occurred_at else delivered_at end,
            next_attempt_at = case
                when p_kind = 'bounce' and not p_hard_bounce then now() + interval '15 minutes'
                else next_attempt_at
            end,
            failure_class = case
                when p_kind = 'complaint' or (p_kind = 'bounce' and p_hard_bounce) then 'suppressed'
                when p_kind = 'bounce' then 'transient'
                when p_kind in ('reject', 'rendering_failure') then 'permanent'
                else failure_class
            end,
            failure_code = case when p_kind in ('bounce', 'complaint', 'reject', 'rendering_failure') then p_kind else failure_code end,
            failure_reason = case when p_kind in ('bounce', 'complaint', 'reject', 'rendering_failure') then p_payload::text else failure_reason end,
            claimed_at = null,
            claim_expires_at = null,
            claim_token = null
        where id = v_delivery_id;

        if p_kind = 'send' then
            update public.delivery_attempts
            set completed_at = coalesce(completed_at, p_occurred_at),
                outcome = coalesce(outcome, 'accepted'),
                ses_message_id = coalesce(ses_message_id, p_ses_message_id)
            where id = (
                select id
                from public.delivery_attempts
                where delivery_id = v_delivery_id
                  and completed_at is null
                order by attempt_number desc
                limit 1
            );
        end if;
    end if;

    v_reason := case
        when p_kind = 'complaint' then 'complaint'
        when p_kind = 'bounce' and p_hard_bounce then 'hard_bounce'
        else null
    end;

    if v_reason is not null and v_contact_id is not null then
        insert into public.suppressions (
            contact_id, reason, scope, source, source_event_id
        ) values (
            v_contact_id, v_reason, 'archivist', 'ses', p_provider_event_id
        )
        on conflict (contact_id, scope, reason) where cleared_at is null do nothing;

        insert into public.ses_contact_preferences (
            contact_id, topic_name, desired_status, sync_status
        ) values (
            v_contact_id, 'archivist-early-access', 'OPT_OUT', 'pending'
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

create function public.apply_ses_preference_event(
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

        insert into public.ses_contact_preferences (
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
        update public.ses_contact_preferences
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

create function public.clear_suppression(
    p_suppression_id uuid,
    p_cleared_by text,
    p_clearance_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_contact_id uuid;
    v_email public.citext;
begin
    if nullif(trim(p_cleared_by), '') is null
        or nullif(trim(p_clearance_reason), '') is null
    then
        raise exception 'clearance identity and reason are required' using errcode = '22023';
    end if;

    update public.suppressions
    set cleared_at = now(),
        cleared_by = p_cleared_by,
        clearance_reason = p_clearance_reason
    where id = p_suppression_id
      and cleared_at is null
    returning contact_id into v_contact_id;

    if not found then
        return false;
    end if;

    select email into v_email from public.contacts where id = v_contact_id;

    insert into public.consent_events (
        contact_id, email_snapshot, kind, source, metadata
    ) values (
        v_contact_id,
        v_email,
        'suppression_cleared',
        'administrative',
        jsonb_build_object(
            'suppression_id', p_suppression_id,
            'cleared_by', p_cleared_by,
            'reason', p_clearance_reason
        )
    );

    return true;
end;
$$;

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create trigger memberships_set_updated_at
before update on public.early_access_memberships
for each row execute function public.set_updated_at();

create trigger ses_preferences_set_updated_at
before update on public.ses_contact_preferences
for each row execute function public.set_updated_at();

create trigger consent_events_append_only
before update or delete on public.consent_events
for each row execute function public.reject_audit_mutation();

create trigger delivery_events_append_only
before update or delete on public.delivery_events
for each row execute function public.reject_audit_mutation();

create trigger delivery_attempts_protect_update
before update on public.delivery_attempts
for each row execute function public.protect_delivery_attempt();

create trigger delivery_attempts_no_delete
before delete on public.delivery_attempts
for each row execute function public.reject_audit_mutation();

create trigger messages_protect_content
before update on public.messages
for each row execute function public.protect_message_content();

alter table public.contacts enable row level security;
alter table public.early_access_memberships enable row level security;
alter table public.consent_events enable row level security;
alter table public.action_tokens enable row level security;
alter table public.suppressions enable row level security;
alter table public.ses_contact_preferences enable row level security;
alter table public.messages enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_attempts enable row level security;
alter table public.delivery_events enable row level security;

revoke all on table public.contacts from anon, authenticated;
revoke all on table public.early_access_memberships from anon, authenticated;
revoke all on table public.consent_events from anon, authenticated;
revoke all on table public.action_tokens from anon, authenticated;
revoke all on table public.suppressions from anon, authenticated;
revoke all on table public.ses_contact_preferences from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.deliveries from anon, authenticated;
revoke all on table public.delivery_attempts from anon, authenticated;
revoke all on table public.delivery_events from anon, authenticated;
revoke all on sequence public.consent_events_id_seq from anon, authenticated;
revoke all on sequence public.delivery_events_id_seq from anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.reject_audit_mutation() from public, anon, authenticated;
revoke execute on function public.protect_message_content() from public, anon, authenticated;
revoke execute on function public.protect_delivery_attempt() from public, anon, authenticated;
revoke execute on function public.request_early_access(text, uuid, bytea, timestamptz, text, text, text)
    from public, anon, authenticated;
revoke execute on function public.confirm_early_access(bytea)
    from public, anon, authenticated;
revoke execute on function public.leave_early_access(bytea, text)
    from public, anon, authenticated;
revoke execute on function public.claim_deliveries(integer, interval)
    from public, anon, authenticated;
revoke execute on function public.claim_confirmation_deliveries(integer, interval)
    from public, anon, authenticated;
revoke execute on function public.record_delivery_event(text, text, uuid, text, jsonb, timestamptz, boolean)
    from public, anon, authenticated;
revoke execute on function public.clear_suppression(uuid, text, text)
    from public, anon, authenticated;
revoke execute on function public.apply_ses_preference_event(text, text, text, timestamptz)
    from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.contacts to service_role;
grant all on table public.early_access_memberships to service_role;
grant all on table public.consent_events to service_role;
grant all on table public.action_tokens to service_role;
grant all on table public.suppressions to service_role;
grant all on table public.ses_contact_preferences to service_role;
grant all on table public.messages to service_role;
grant all on table public.deliveries to service_role;
grant all on table public.delivery_attempts to service_role;
grant all on table public.delivery_events to service_role;
grant usage, select on sequence public.consent_events_id_seq to service_role;
grant usage, select on sequence public.delivery_events_id_seq to service_role;
grant execute on function public.request_early_access(text, uuid, bytea, timestamptz, text, text, text)
    to service_role;
grant execute on function public.confirm_early_access(bytea) to service_role;
grant execute on function public.leave_early_access(bytea, text) to service_role;
grant execute on function public.claim_deliveries(integer, interval) to service_role;
grant execute on function public.claim_confirmation_deliveries(integer, interval) to service_role;
grant execute on function public.record_delivery_event(text, text, uuid, text, jsonb, timestamptz, boolean)
    to service_role;
grant execute on function public.clear_suppression(uuid, text, text) to service_role;
grant execute on function public.apply_ses_preference_event(text, text, text, timestamptz)
    to service_role;

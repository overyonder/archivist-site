-- Reinstall the request function after qualifying the attempt columns used by
-- the daily capacity check. Its OUT parameter is also named `outcome`, so an
-- unqualified reference is ambiguous in PL/pgSQL.

create or replace function public.request_early_access(
    p_email text,
    p_token_id uuid,
    p_token_hash bytea,
    p_expires_at timestamptz,
    p_source text,
    p_form_version text,
    p_policy_version text,
    p_request_fingerprint bytea,
    p_email_fingerprint bytea
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
    v_has_live_place boolean := false;
    v_places_taken bigint;
begin
    if length(v_email::text) > 254
        or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        or p_request_fingerprint is null
        or p_email_fingerprint is null
    then
        raise exception 'invalid early-access request' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtext('archivist-early-access-request'));

    if (
        select count(*) >= 10
        from public.early_access_request_attempts attempt
        where attempt.request_fingerprint = p_request_fingerprint
          and attempt.attempted_at > now() - interval '1 hour'
    ) or (
        select count(*) >= 3
        from public.early_access_request_attempts attempt
        where attempt.email_fingerprint = p_email_fingerprint
          and attempt.attempted_at > now() - interval '24 hours'
    ) then
        insert into public.early_access_request_attempts (
            request_fingerprint, email_fingerprint, outcome
        ) values (p_request_fingerprint, p_email_fingerprint, 'rate_limited');
        return query select 'rate_limited'::text, null::uuid, null::uuid;
        return;
    end if;

    select contact.id, membership.status
    into v_contact_id, v_membership_status
    from public.contacts contact
    left join public.early_access_memberships membership on membership.contact_id = contact.id
    where contact.email = v_email;

    if v_contact_id is not null and exists (
        select 1
        from public.suppressions suppression
        where suppression.contact_id = v_contact_id
          and suppression.cleared_at is null
          and suppression.scope in ('archivist', 'all')
    ) then
        insert into public.early_access_request_attempts (
            request_fingerprint, email_fingerprint, outcome
        ) values (p_request_fingerprint, p_email_fingerprint, 'suppressed');
        return query select 'suppressed'::text, v_contact_id, null::uuid;
        return;
    end if;

    if v_membership_status = 'confirmed' then
        insert into public.early_access_request_attempts (
            request_fingerprint, email_fingerprint, outcome
        ) values (p_request_fingerprint, p_email_fingerprint, 'already_confirmed');
        return query select 'already_confirmed'::text, v_contact_id, null::uuid;
        return;
    end if;

    if v_contact_id is not null then
        select exists (
            select 1
            from public.action_tokens token
            where token.contact_id = v_contact_id
              and token.purpose = 'confirm'
              and token.consumed_at is null
              and token.expires_at > now()
        ) into v_has_live_place;

        if v_has_live_place and exists (
            select 1
            from public.consent_events event
            where event.contact_id = v_contact_id
              and event.kind in ('join_requested', 'rejoin_requested')
              and event.occurred_at > now() - interval '15 minutes'
        ) then
            insert into public.early_access_request_attempts (
                request_fingerprint, email_fingerprint, outcome
            ) values (p_request_fingerprint, p_email_fingerprint, 'recently_requested');
            return query select 'recently_requested'::text, v_contact_id, null::uuid;
            return;
        end if;
    end if;

    select count(*) into v_places_taken
    from public.early_access_memberships membership
    where membership.status = 'confirmed'
       or (
           membership.status = 'pending'
           and exists (
               select 1
               from public.action_tokens token
               where token.contact_id = membership.contact_id
                 and token.purpose = 'confirm'
                 and token.consumed_at is null
                 and token.expires_at > now()
           )
       );

    if not v_has_live_place and v_places_taken >= 10000 then
        insert into public.early_access_request_attempts (
            request_fingerprint, email_fingerprint, outcome
        ) values (p_request_fingerprint, p_email_fingerprint, 'full');
        return query select 'full'::text, v_contact_id, null::uuid;
        return;
    end if;

    if (
        select count(*) >= 1000
        from public.early_access_request_attempts attempt
        where attempt.outcome = 'confirmation_required'
          and attempt.attempted_at > now() - interval '24 hours'
    ) then
        insert into public.early_access_request_attempts (
            request_fingerprint, email_fingerprint, outcome
        ) values (p_request_fingerprint, p_email_fingerprint, 'daily_limit');
        return query select 'daily_limit'::text, v_contact_id, null::uuid;
        return;
    end if;

    insert into public.contacts (email)
    values (v_email)
    on conflict (email) do update set email = excluded.email
    returning id into v_contact_id;

    insert into public.consent_events (
        contact_id, email_snapshot, kind, source, form_version, policy_version
    ) values (
        v_contact_id,
        v_email,
        case when v_membership_status is null then 'join_requested' else 'rejoin_requested' end,
        p_source,
        p_form_version,
        p_policy_version
    );

    update public.action_tokens token
    set consumed_at = now()
    where token.contact_id = v_contact_id
      and token.purpose = 'confirm'
      and token.consumed_at is null;

    insert into public.early_access_memberships (
        contact_id, status, requested_at, confirmed_at, left_at
    ) values (v_contact_id, 'pending', now(), null, null)
    on conflict on constraint early_access_memberships_pkey do update set
        status = 'pending', requested_at = excluded.requested_at,
        confirmed_at = null, left_at = null;

    insert into public.action_tokens (id, contact_id, purpose, token_hash, expires_at)
    values (p_token_id, v_contact_id, 'confirm', p_token_hash, p_expires_at)
    returning id into v_token_id;

    insert into public.early_access_request_attempts (
        request_fingerprint, email_fingerprint, outcome
    ) values (p_request_fingerprint, p_email_fingerprint, 'confirmation_required');

    return query select 'confirmation_required'::text, v_contact_id, v_token_id;
end;
$$;

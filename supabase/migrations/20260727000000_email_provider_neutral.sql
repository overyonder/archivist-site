alter table public.ses_contact_preferences
    rename to email_contact_preferences;

alter index public.ses_contact_preferences_pending_idx
    rename to email_contact_preferences_pending_idx;

alter table public.email_contact_preferences
    rename constraint ses_preference_sync_consistent
    to email_preference_sync_consistent;

alter table public.deliveries
    rename column ses_message_id to provider_message_id;

alter table public.delivery_attempts
    rename column ses_message_id to provider_message_id;

alter table public.delivery_events
    rename column ses_message_id to provider_message_id;

alter table public.deliveries
    rename constraint deliveries_ses_message_id_key
    to deliveries_provider_message_id_key;

alter table public.delivery_attempts
    rename constraint delivery_attempts_ses_message_id_key
    to delivery_attempts_provider_message_id_key;

alter index public.delivery_events_ses_message_idx
    rename to delivery_events_provider_message_idx;

drop function public.record_delivery_event(
    text, text, uuid, text, jsonb, timestamptz, boolean
);

create function public.record_delivery_event(
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
            when p_kind = 'send' then 'accepted'
            when p_kind = 'delivery' then 'delivered'
            when p_kind = 'complaint' then 'suppressed'
            when p_kind = 'bounce' and p_hard_bounce then 'suppressed'
            when p_kind in ('bounce', 'reject', 'rendering_failure') then 'failed'
            else status
        end,
        accepted_at = case
            when p_kind = 'send' then p_occurred_at
            else accepted_at
        end,
        delivered_at = case
            when p_kind = 'delivery' then p_occurred_at
            else delivered_at
        end,
        next_attempt_at = case
            when p_kind = 'bounce' and not p_hard_bounce
                then now() + interval '15 minutes'
            else next_attempt_at
        end,
        failure_class = case
            when p_kind = 'complaint'
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
                'rendering_failure'
            ) then p_kind
            else failure_code
        end,
        failure_reason = case
            when p_kind in (
                'bounce',
                'complaint',
                'reject',
                'rendering_failure'
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

revoke execute on function public.record_delivery_event(
    text, text, uuid, text, jsonb, timestamptz, boolean
) from public, anon, authenticated;

grant execute on function public.record_delivery_event(
    text, text, uuid, text, jsonb, timestamptz, boolean
) to service_role;

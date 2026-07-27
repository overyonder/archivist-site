alter table public.deliveries
    drop constraint delivery_source_consistent;

alter table public.deliveries
    add constraint delivery_source_consistent check (
        (
            kind = 'confirmation'
            and message_id is null
            and action_token_id is not null
        )
        or
        (
            kind = 'early_access_update'
            and message_id is not null
        )
    );

create function public.queue_early_access_update(
    p_slug text,
    p_subject text,
    p_content_digest text,
    p_source_revision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_message public.messages%rowtype;
    v_deliveries_queued integer;
begin
    if nullif(trim(p_slug), '') is null
        or nullif(trim(p_subject), '') is null
        or nullif(trim(p_content_digest), '') is null
        or nullif(trim(p_source_revision), '') is null
    then
        raise exception 'message metadata is required'
            using errcode = '22023';
    end if;

    insert into public.messages (
        slug,
        subject,
        content_digest,
        source_revision,
        status,
        queued_at
    ) values (
        p_slug,
        p_subject,
        p_content_digest,
        p_source_revision,
        'queued',
        now()
    )
    on conflict (slug) do nothing
    returning * into v_message;

    if not found then
        select * into v_message
        from public.messages
        where slug = p_slug;

        if v_message.subject <> p_subject
            or v_message.content_digest <> p_content_digest
            or v_message.source_revision <> p_source_revision
        then
            raise exception 'message slug already has different immutable metadata'
                using errcode = '23505';
        end if;

        return jsonb_build_object(
            'message_id', v_message.id,
            'deliveries_queued', 0,
            'status', v_message.status
        );
    end if;

    insert into public.deliveries (
        kind,
        message_id,
        contact_id
    )
    select
        'early_access_update',
        v_message.id,
        membership.contact_id
    from public.early_access_memberships membership
    join public.email_contact_preferences preference
      on preference.contact_id = membership.contact_id
     and preference.topic_name = 'archivist-early-access'
    where membership.status = 'confirmed'
      and preference.desired_status = 'OPT_IN'
      and preference.observed_status = 'OPT_IN'
      and preference.sync_status = 'synced'
      and not exists (
          select 1
          from public.suppressions suppression
          where suppression.contact_id = membership.contact_id
            and suppression.cleared_at is null
            and suppression.scope in ('archivist', 'all')
      )
    on conflict (message_id, contact_id)
        where kind = 'early_access_update'
        do nothing;

    get diagnostics v_deliveries_queued = row_count;

    return jsonb_build_object(
        'message_id', v_message.id,
        'deliveries_queued', v_deliveries_queued,
        'status', v_message.status
    );
end;
$$;

revoke execute on function public.queue_early_access_update(
    text, text, text, text
) from public, anon, authenticated;

grant execute on function public.queue_early_access_update(
    text, text, text, text
) to service_role;

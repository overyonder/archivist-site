-- Moving citext into the extensions schema left stored PL/pgSQL definitions
-- referring to its former public path. Recreate every affected function from
-- its current catalogue definition before adding the signup wrapper.
do $$
declare
    v_definition text;
begin
    for v_definition in
        select pg_get_functiondef(procedure.oid)
        from pg_proc procedure
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.prokind = 'f'
          and pg_get_functiondef(procedure.oid) like '%public.citext%'
    loop
        execute replace(
            v_definition,
            'public.citext',
            'extensions.citext'
        );
    end loop;
end;
$$;

alter table public.consent_events
    drop constraint consent_events_kind_check;

alter table public.consent_events
    add constraint consent_events_kind_check check (
        kind in (
            'join_requested',
            'rejoin_requested',
            'confirmed',
            'left',
            'suppression_cleared',
            'signup_preferences_recorded'
        )
    );

create function public.request_early_access_v2(
    p_email text,
    p_token_id uuid,
    p_token_hash bytea,
    p_expires_at timestamptz,
    p_source text,
    p_form_version text,
    p_policy_version text,
    p_request_fingerprint bytea,
    p_email_fingerprint bytea,
    p_product_research boolean,
    p_attribution jsonb
)
returns table (outcome text, contact_id uuid, token_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result record;
    v_email public.contacts.email%type;
begin
    if p_product_research is null
        or p_attribution is null
        or jsonb_typeof(p_attribution) <> 'object'
        or octet_length(p_attribution::text) > 1024
    then
        raise exception 'invalid signup preferences' using errcode = '22023';
    end if;

    select * into v_result
    from public.request_early_access(
        p_email,
        p_token_id,
        p_token_hash,
        p_expires_at,
        p_source,
        p_form_version,
        p_policy_version,
        p_request_fingerprint,
        p_email_fingerprint
    );

    if v_result.outcome = 'confirmation_required' then
        select email into v_email
        from public.contacts
        where id = v_result.contact_id;

        insert into public.consent_events (
            contact_id,
            email_snapshot,
            kind,
            source,
            form_version,
            policy_version,
            metadata
        ) values (
            v_result.contact_id,
            v_email,
            'signup_preferences_recorded',
            p_source,
            p_form_version,
            p_policy_version,
            jsonb_build_object(
                'product_research', p_product_research,
                'attribution', p_attribution
            )
        );
    end if;

    return query
    select v_result.outcome, v_result.contact_id, v_result.token_id;
end;
$$;

revoke execute on function public.request_early_access_v2(
    text,
    uuid,
    bytea,
    timestamptz,
    text,
    text,
    text,
    bytea,
    bytea,
    boolean,
    jsonb
) from public, anon, authenticated;

grant execute on function public.request_early_access_v2(
    text,
    uuid,
    bytea,
    timestamptz,
    text,
    text,
    text,
    bytea,
    bytea,
    boolean,
    jsonb
) to service_role;

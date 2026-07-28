drop view public.feature_emphasis_summary;

drop function public.record_feature_emphasis(
    text,
    uuid,
    text,
    bytea,
    uuid,
    text
);

drop function public.request_early_access_with_preferences(
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
    jsonb,
    uuid,
    text
);

drop table public.feature_emphasis_selections;

alter table public.feature_emphasis_assignments
    drop constraint feature_emphasis_assignments_pkey,
    drop constraint feature_emphasis_assignments_initial_feature_check;

alter table public.feature_emphasis_assignments
    rename to signup_attributions;

alter table public.signup_attributions
    rename column initial_feature to pro_first_feature;

alter table public.signup_attributions
    rename column first_seen_at to pro_first_seen_at;

alter table public.signup_attributions
    add column signup_source text not null default 'pro',
    add column updated_at timestamptz not null default now();

alter table public.signup_attributions
    alter column signup_source drop default,
    alter column pro_first_feature drop not null,
    alter column pro_first_seen_at drop not null,
    drop column emphasis_key,
    add primary key (subject_id),
    add constraint signup_attributions_signup_source_check
        check (signup_source ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
    add constraint signup_attributions_pro_first_feature_check
        check (
            pro_first_feature is null
            or pro_first_feature ~ '^[a-z0-9][a-z0-9-]{0,63}$'
        );

alter index public.feature_emphasis_assignments_contact_idx
    rename to signup_attributions_contact_idx;

alter table public.feature_emphasis_requests
    rename to signup_attribution_requests;

alter index public.feature_emphasis_requests_pkey
    rename to signup_attribution_requests_pkey;

alter index public.feature_emphasis_requests_fingerprint_time_idx
    rename to signup_attribution_requests_fingerprint_time_idx;

alter sequence public.feature_emphasis_requests_id_seq
    rename to signup_attribution_requests_id_seq;

create function public.record_pro_feature(
    p_subject_id uuid,
    p_first_feature text,
    p_request_fingerprint bytea
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_first_feature text;
begin
    if p_subject_id is null
        or p_first_feature is null
        or p_first_feature !~ '^[a-z0-9][a-z0-9-]{0,63}$'
        or p_request_fingerprint is null
    then
        raise exception 'invalid Pro feature record' using errcode = '22023';
    end if;

    if (
        select count(*) >= 120
        from public.signup_attribution_requests
        where request_fingerprint = p_request_fingerprint
          and requested_at > now() - interval '1 hour'
    ) then
        raise exception 'Pro feature rate limit reached';
    end if;

    insert into public.signup_attribution_requests (request_fingerprint)
    values (p_request_fingerprint);

    insert into public.signup_attributions (
        subject_id,
        signup_source,
        pro_first_feature
    ) values (
        p_subject_id,
        'pro',
        p_first_feature
    )
    on conflict (subject_id) do nothing;

    select pro_first_feature into v_first_feature
    from public.signup_attributions
    where subject_id = p_subject_id;

    if v_first_feature <> p_first_feature then
        raise exception 'Pro feature does not match first assignment'
            using errcode = '22023';
    end if;
end;
$$;

revoke execute on function public.record_pro_feature(
    uuid,
    text,
    bytea
) from public, anon, authenticated;

grant execute on function public.record_pro_feature(
    uuid,
    text,
    bytea
) to service_role;

create function public.request_early_access_with_preferences(
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
    p_attribution jsonb,
    p_attribution_subject_id uuid,
    p_signup_source text,
    p_pro_first_feature text
)
returns table (outcome text, contact_id uuid, token_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result record;
    v_email public.contacts.email%type;
    v_attribution_rows integer;
begin
    if p_product_research is null
        or p_attribution is null
        or jsonb_typeof(p_attribution) <> 'object'
        or octet_length(p_attribution::text) > 1024
        or p_attribution_subject_id is null
        or p_signup_source is null
        or p_signup_source !~ '^[a-z0-9][a-z0-9-]{0,63}$'
        or (
            p_pro_first_feature is not null
            and p_pro_first_feature !~ '^[a-z0-9][a-z0-9-]{0,63}$'
        )
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

        insert into public.signup_attributions (
            subject_id,
            signup_source,
            pro_first_feature,
            contact_id,
            pro_first_seen_at
        ) values (
            p_attribution_subject_id,
            p_signup_source,
            p_pro_first_feature,
            v_result.contact_id,
            case
                when p_pro_first_feature is null then null
                else now()
            end
        )
        on conflict (subject_id) do update
        set signup_source = excluded.signup_source,
            pro_first_feature = coalesce(
                signup_attributions.pro_first_feature,
                excluded.pro_first_feature
            ),
            contact_id = excluded.contact_id,
            updated_at = now()
        where (
                signup_attributions.pro_first_feature is null
                or excluded.pro_first_feature is null
                or signup_attributions.pro_first_feature =
                    excluded.pro_first_feature
            )
          and (
                signup_attributions.contact_id is null
                or signup_attributions.contact_id = excluded.contact_id
            );

        get diagnostics v_attribution_rows = row_count;
        if v_attribution_rows <> 1 then
            raise exception 'signup attribution does not match'
                using errcode = '22023';
        end if;
    end if;

    return query
    select v_result.outcome, v_result.contact_id, v_result.token_id;
end;
$$;

revoke execute on function public.request_early_access_with_preferences(
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
    jsonb,
    uuid,
    text,
    text
) from public, anon, authenticated;

grant execute on function public.request_early_access_with_preferences(
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
    jsonb,
    uuid,
    text,
    text
) to service_role;

create view public.signup_source_summary
with (security_invoker = true)
as
select
    attribution.signup_source,
    count(*) as release_list_signups,
    count(*) filter (
        where membership.status = 'confirmed'
    ) as confirmed_signups
from public.signup_attributions attribution
join public.early_access_memberships membership
    on membership.contact_id = attribution.contact_id
group by attribution.signup_source;

create view public.pro_feature_summary
with (security_invoker = true)
as
select
    attribution.pro_first_feature,
    count(*) as people_shown,
    count(attribution.contact_id) as release_list_signups,
    count(attribution.contact_id) filter (
        where membership.status = 'confirmed'
    ) as confirmed_signups,
    round(
        100.0 * count(attribution.contact_id) filter (
            where membership.status = 'confirmed'
        ) / nullif(count(*), 0),
        2
    ) as confirmed_signup_percent
from public.signup_attributions attribution
left join public.early_access_memberships membership
    on membership.contact_id = attribution.contact_id
where attribution.pro_first_feature is not null
group by attribution.pro_first_feature;

revoke all on table public.signup_source_summary
from public, anon, authenticated;
revoke all on table public.pro_feature_summary
from public, anon, authenticated;
grant select on table public.signup_source_summary to service_role;
grant select on table public.pro_feature_summary to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'archivist-feature-emphasis-cleanup';

select cron.schedule(
    'archivist-signup-attribution-cleanup',
    '15 3 * * *',
    $cleanup$
        delete from public.signup_attribution_requests
        where requested_at < now() - interval '2 days';
    $cleanup$
)
where not exists (
    select 1
    from cron.job
    where jobname = 'archivist-signup-attribution-cleanup'
);

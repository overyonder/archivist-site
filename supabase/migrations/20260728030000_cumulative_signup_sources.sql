drop view public.signup_source_summary;
drop view public.pro_feature_summary;

drop function public.record_pro_feature(
    uuid,
    text,
    bytea
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
    text,
    text
);

create table public.signup_attribution_sources (
    subject_id uuid not null
        references public.signup_attributions (subject_id) on delete cascade,
    source_page text not null
        check (source_page ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
    first_seen_order smallint not null
        check (first_seen_order between 1 and 16),
    recorded_at timestamptz not null default now(),
    primary key (subject_id, source_page),
    unique (subject_id, first_seen_order)
);

insert into public.signup_attribution_sources (
    subject_id,
    source_page,
    first_seen_order,
    recorded_at
)
select
    subject_id,
    signup_source,
    1,
    coalesce(pro_first_seen_at, updated_at)
from public.signup_attributions;

alter table public.signup_attributions
    drop constraint signup_attributions_signup_source_check,
    drop column signup_source;

alter table public.signup_attribution_sources enable row level security;

revoke all on table public.signup_attribution_sources
from public, anon, authenticated;
grant all on table public.signup_attribution_sources to service_role;

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
        pro_first_feature
    ) values (
        p_subject_id,
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

    insert into public.signup_attribution_sources (
        subject_id,
        source_page,
        first_seen_order
    ) values (
        p_subject_id,
        'pro',
        1
    )
    on conflict (subject_id, source_page) do nothing;
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
    p_signup_sources text[],
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
        or p_signup_sources is null
        or cardinality(p_signup_sources) not between 1 and 16
        or exists (
            select 1
            from unnest(p_signup_sources) source_page
            where source_page is null
               or source_page !~ '^[a-z0-9][a-z0-9-]{0,63}$'
        )
        or (
            select count(distinct source_page) <> cardinality(p_signup_sources)
            from unnest(p_signup_sources) source_page
        )
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
            pro_first_feature,
            contact_id,
            pro_first_seen_at
        ) values (
            p_attribution_subject_id,
            p_pro_first_feature,
            v_result.contact_id,
            case
                when p_pro_first_feature is null then null
                else now()
            end
        )
        on conflict (subject_id) do update
        set pro_first_feature = coalesce(
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

        delete from public.signup_attribution_sources
        where subject_id = p_attribution_subject_id;

        insert into public.signup_attribution_sources (
            subject_id,
            source_page,
            first_seen_order
        )
        select
            p_attribution_subject_id,
            source.source_page,
            source.first_seen_order::smallint
        from unnest(p_signup_sources)
            with ordinality as source(source_page, first_seen_order);
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
    text[],
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
    text[],
    text
) to service_role;

create view public.signup_source_summary
with (security_invoker = true)
as
select
    source.source_page as signup_source,
    count(*) filter (
        where attribution.contact_id is not null
    ) as release_list_signups,
    count(*) filter (
        where membership.status = 'confirmed'
    ) as confirmed_signups
from public.signup_attribution_sources source
join public.signup_attributions attribution
    on attribution.subject_id = source.subject_id
left join public.early_access_memberships membership
    on membership.contact_id = attribution.contact_id
group by source.source_page;

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

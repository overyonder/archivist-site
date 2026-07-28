create table public.feature_emphasis_assignments (
    emphasis_key text not null,
    subject_id uuid not null,
    initial_feature text not null check (initial_feature in ('canon', 'atlas')),
    contact_id uuid references public.contacts (id),
    first_seen_at timestamptz not null default now(),
    primary key (emphasis_key, subject_id)
);

create index feature_emphasis_assignments_contact_idx
    on public.feature_emphasis_assignments (contact_id)
    where contact_id is not null;

create table public.feature_emphasis_selections (
    event_id uuid primary key,
    emphasis_key text not null,
    subject_id uuid not null,
    selected_feature text not null check (selected_feature in ('canon', 'atlas')),
    selected_at timestamptz not null default now(),
    foreign key (emphasis_key, subject_id)
        references public.feature_emphasis_assignments (emphasis_key, subject_id)
);

create table public.feature_emphasis_requests (
    id bigint generated always as identity primary key,
    request_fingerprint bytea not null,
    requested_at timestamptz not null default now()
);

create index feature_emphasis_requests_fingerprint_time_idx
    on public.feature_emphasis_requests (request_fingerprint, requested_at desc);

alter table public.feature_emphasis_assignments enable row level security;
alter table public.feature_emphasis_selections enable row level security;
alter table public.feature_emphasis_requests enable row level security;

revoke all on table public.feature_emphasis_assignments
from public, anon, authenticated;
revoke all on table public.feature_emphasis_selections
from public, anon, authenticated;
revoke all on table public.feature_emphasis_requests
from public, anon, authenticated;
revoke all on sequence public.feature_emphasis_requests_id_seq
from public, anon, authenticated;

grant all on table public.feature_emphasis_assignments to service_role;
grant all on table public.feature_emphasis_selections to service_role;
grant all on table public.feature_emphasis_requests to service_role;
grant usage, select on sequence public.feature_emphasis_requests_id_seq
to service_role;

create function public.record_feature_emphasis(
    p_emphasis_key text,
    p_subject_id uuid,
    p_initial_feature text,
    p_request_fingerprint bytea,
    p_event_id uuid,
    p_selected_feature text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_initial_feature text;
begin
    if p_emphasis_key <> 'pro-benefit-emphasis-v1'
        or p_subject_id is null
        or p_initial_feature not in ('canon', 'atlas')
        or p_request_fingerprint is null
        or ((p_event_id is null) <> (p_selected_feature is null))
        or (
            p_selected_feature is not null
            and p_selected_feature not in ('canon', 'atlas')
        )
    then
        raise exception 'invalid feature emphasis' using errcode = '22023';
    end if;

    if (
        select count(*) >= 120
        from public.feature_emphasis_requests
        where request_fingerprint = p_request_fingerprint
          and requested_at > now() - interval '1 hour'
    ) then
        raise exception 'feature emphasis rate limit reached';
    end if;

    insert into public.feature_emphasis_requests (request_fingerprint)
    values (p_request_fingerprint);

    insert into public.feature_emphasis_assignments (
        emphasis_key,
        subject_id,
        initial_feature
    ) values (
        p_emphasis_key,
        p_subject_id,
        p_initial_feature
    )
    on conflict (emphasis_key, subject_id) do nothing;

    select initial_feature into v_initial_feature
    from public.feature_emphasis_assignments
    where emphasis_key = p_emphasis_key
      and subject_id = p_subject_id;

    if v_initial_feature <> p_initial_feature then
        raise exception 'feature emphasis does not match initial assignment'
            using errcode = '22023';
    end if;

    if p_selected_feature is not null then
        insert into public.feature_emphasis_selections (
            event_id,
            emphasis_key,
            subject_id,
            selected_feature
        ) values (
            p_event_id,
            p_emphasis_key,
            p_subject_id,
            p_selected_feature
        )
        on conflict (event_id) do nothing;
    end if;
end;
$$;

revoke execute on function public.record_feature_emphasis(
    text,
    uuid,
    text,
    bytea,
    uuid,
    text
) from public, anon, authenticated;

grant execute on function public.record_feature_emphasis(
    text,
    uuid,
    text,
    bytea,
    uuid,
    text
) to service_role;

drop function public.request_early_access_v2(
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
);

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
    p_emphasis_subject_id uuid,
    p_initial_feature text
)
returns table (outcome text, contact_id uuid, token_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result record;
    v_email public.citext;
begin
    if p_product_research is null
        or p_attribution is null
        or jsonb_typeof(p_attribution) <> 'object'
        or octet_length(p_attribution::text) > 1024
        or ((p_emphasis_subject_id is null) <> (p_initial_feature is null))
        or (
            p_initial_feature is not null
            and p_initial_feature not in ('canon', 'atlas')
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

        if p_emphasis_subject_id is not null then
            insert into public.feature_emphasis_assignments (
                emphasis_key,
                subject_id,
                initial_feature,
                contact_id
            ) values (
                'pro-benefit-emphasis-v1',
                p_emphasis_subject_id,
                p_initial_feature,
                v_result.contact_id
            )
            on conflict (emphasis_key, subject_id) do update
            set contact_id = excluded.contact_id
            where feature_emphasis_assignments.initial_feature =
                    excluded.initial_feature
              and (
                  feature_emphasis_assignments.contact_id is null
                  or feature_emphasis_assignments.contact_id =
                        excluded.contact_id
              );
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
    text
) to service_role;

create view public.feature_emphasis_summary
with (security_invoker = true)
as
with selections as (
    select
        emphasis_key,
        subject_id,
        count(*) as selection_count,
        count(*) filter (where selected_feature = 'canon')
            as canon_selections,
        count(*) filter (where selected_feature = 'atlas')
            as atlas_selections
    from public.feature_emphasis_selections
    group by emphasis_key, subject_id
)
select
    assignment.emphasis_key,
    assignment.initial_feature,
    count(*) as people_shown,
    count(assignment.contact_id) as release_list_signups,
    count(assignment.contact_id) filter (
        where membership.status = 'confirmed'
    ) as confirmed_signups,
    round(
        100.0 * count(assignment.contact_id) filter (
            where membership.status = 'confirmed'
        ) / nullif(count(*), 0),
        2
    ) as confirmed_signup_percent,
    coalesce(sum(selections.selection_count), 0) as feature_selections,
    coalesce(sum(selections.canon_selections), 0) as canon_selections,
    coalesce(sum(selections.atlas_selections), 0) as atlas_selections
from public.feature_emphasis_assignments assignment
left join public.early_access_memberships membership
    on membership.contact_id = assignment.contact_id
left join selections
    on selections.emphasis_key = assignment.emphasis_key
   and selections.subject_id = assignment.subject_id
group by assignment.emphasis_key, assignment.initial_feature;

revoke all on table public.feature_emphasis_summary
from public, anon, authenticated;
grant select on table public.feature_emphasis_summary to service_role;

select cron.schedule(
    'archivist-feature-emphasis-cleanup',
    '15 3 * * *',
    $cleanup$
        delete from public.feature_emphasis_requests
        where requested_at < now() - interval '2 days';
    $cleanup$
)
where not exists (
    select 1
    from cron.job
    where jobname = 'archivist-feature-emphasis-cleanup'
);

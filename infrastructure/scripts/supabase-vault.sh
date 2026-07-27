#!/usr/bin/env bash
set -euo pipefail

: "${INTERNAL_FUNCTION_SECRET:?INTERNAL_FUNCTION_SECRET is required}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

if [[ ! "$INTERNAL_FUNCTION_SECRET" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "INTERNAL_FUNCTION_SECRET must be an alphanumeric generated value." >&2
  exit 1
fi

read -r -d '' query <<SQL || true
do \$\$
declare
    existing_secret_id uuid;
begin
    select id into existing_secret_id
    from vault.secrets
    where name = 'archivist_reconciler_internal_secret';

    if existing_secret_id is null then
        perform vault.create_secret(
            '${INTERNAL_FUNCTION_SECRET}',
            'archivist_reconciler_internal_secret',
            'Credential used only by the database scheduler to invoke the protected reconciler.'
        );
    else
        perform vault.update_secret(
            existing_secret_id,
            '${INTERNAL_FUNCTION_SECRET}',
            'archivist_reconciler_internal_secret',
            'Credential used only by the database scheduler to invoke the protected reconciler.'
        );
    end if;
end;
\$\$;
SQL

response=$(
  jq -n --arg query "$query" '{query:$query}' |
    curl --fail-with-body --silent --show-error \
      --request POST \
      --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      --header "Content-Type: application/json" \
      --data-binary @- \
      "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
)

if ! jq -e 'type == "array"' <<<"$response" >/dev/null; then
  echo "Supabase did not accept the reconciler Vault secret update." >&2
  exit 1
fi

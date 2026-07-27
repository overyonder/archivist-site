#!/usr/bin/env bash

set -euo pipefail

readonly api_base="https://api.resend.com"
readonly user_agent="archivist-opentofu/1.0"
readonly operation=${1:-}

if [[ -z "${RESEND_API_KEY:-}" ]]; then
  echo "RESEND_API_KEY must contain the full-access OpenTofu administration key." >&2
  exit 1
fi

work_dir=$(mktemp -d)
curl_config="${work_dir}/curl.conf"
trap 'rm -rf "$work_dir"' EXIT
chmod 700 "$work_dir"

{
  printf 'silent\n'
  printf 'show-error\n'
  printf 'header = "Authorization: Bearer %s"\n' "$RESEND_API_KEY"
  printf 'header = "User-Agent: %s"\n' "$user_agent"
  printf 'header = "Content-Type: application/json"\n'
} > "$curl_config"
chmod 600 "$curl_config"

api() {
  local method=$1
  local path=$2
  local body=${3:-}
  local response_file="${work_dir}/response-${RANDOM}.json"
  local status

  if [[ -n "$body" ]]; then
    status=$(
      curl --config "$curl_config" \
        --request "$method" \
        --data-binary "$body" \
        --output "$response_file" \
        --write-out '%{http_code}' \
        "${api_base}${path}"
    )
  else
    status=$(
      curl --config "$curl_config" \
        --request "$method" \
        --output "$response_file" \
        --write-out '%{http_code}' \
        "${api_base}${path}"
    )
  fi

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    local message
    message=$(jq -r '.message // .name // "unknown API error"' "$response_file" 2>/dev/null || true)
    echo "Resend API ${method} ${path} failed with HTTP ${status}: ${message}" >&2
    return 1
  fi

  cat "$response_file"
}

read_desired_json() {
  if [[ "$operation" == "inspect" ]]; then
    jq -er '.desired_json'
  else
    if [[ -z "${RESEND_DESIRED_JSON:-}" ]]; then
      echo "RESEND_DESIRED_JSON is required for ${operation}." >&2
      exit 1
    fi
    printf '%s' "$RESEND_DESIRED_JSON"
  fi
}

require_single_match() {
  local count=$1
  local description=$2
  if [[ "$count" -gt 1 ]]; then
    echo "Resend returned more than one ${description}; refusing an ambiguous reconciliation." >&2
    exit 1
  fi
}

find_domain() {
  local domain_name=$1
  local domains
  local count

  domains=$(api GET "/domains")
  count=$(jq --arg name "$domain_name" '[.data[] | select(.name == $name)] | length' <<< "$domains")
  require_single_match "$count" "domain named ${domain_name}"
  jq --arg name "$domain_name" -c '.data[]? | select(.name == $name)' <<< "$domains"
}

find_webhook() {
  local endpoint=$1
  local webhooks
  local count

  webhooks=$(api GET "/webhooks")
  count=$(jq --arg endpoint "$endpoint" '[.data[] | select(.endpoint == $endpoint)] | length' <<< "$webhooks")
  require_single_match "$count" "webhook for ${endpoint}"
  jq --arg endpoint "$endpoint" -c '.data[]? | select(.endpoint == $endpoint)' <<< "$webhooks"
}

find_runtime_key() {
  local key_id=$1
  local keys
  local count

  keys=$(api GET "/api-keys")
  count=$(jq --arg id "$key_id" '[.data[] | select(.id == $id)] | length' <<< "$keys")
  require_single_match "$count" "API key with ID ${key_id}"
  jq --arg id "$key_id" -c '.data[]? | select(.id == $id)' <<< "$keys"
}

domain_is_desired() {
  local domain=$1
  local desired=$2

  jq -e --argjson desired "$desired" '
    .name == $desired.domain.name
    and .region == $desired.domain.region
    and (.tls == null or .tls == $desired.domain.tls)
    and .open_tracking == $desired.domain.open_tracking
    and .click_tracking == $desired.domain.click_tracking
    and .capabilities.sending == $desired.domain.capabilities.sending
    and .capabilities.receiving == $desired.domain.capabilities.receiving
    and .status == "verified"
    and (
      [.records[] | {
        name,
        type,
        content: .value,
        priority: (.priority // null)
      }] | sort_by(.name, .type)
    ) == ($desired.dns_records | sort_by(.name, .type))
  ' <<< "$domain" >/dev/null
}

webhook_is_desired() {
  local webhook=$1
  local desired=$2

  jq -e --argjson desired "$desired" '
    .endpoint == $desired.webhook.endpoint
    and .status == $desired.webhook.status
    and (.events | sort) == ($desired.webhook.events | sort)
  ' <<< "$webhook" >/dev/null
}

runtime_key_is_desired() {
  local runtime_key=$1
  local desired=$2

  jq -e --argjson desired "$desired" '
    .id == $desired.runtime_key.id
    and .name == $desired.runtime_key.name
  ' <<< "$runtime_key" >/dev/null
}

inspect() {
  local desired=$1
  local include_secrets=$2
  local desired_hash
  local domain_summary
  local webhook_summary
  local runtime_key
  local domain="null"
  local webhook="null"
  local domain_id=""
  local webhook_id=""
  local runtime_key_id=""
  local webhook_signing_secret=""
  local matches="false"
  local observed_hash

  desired_hash=$(printf '%s' "$desired" | sha256sum | cut -d' ' -f1)
  domain_summary=$(find_domain "$(jq -r '.domain.name' <<< "$desired")")
  webhook_summary=$(find_webhook "$(jq -r '.webhook.endpoint' <<< "$desired")")
  runtime_key=$(find_runtime_key "$(jq -r '.runtime_key.id' <<< "$desired")")

  if [[ -n "$domain_summary" ]]; then
    domain_id=$(jq -r '.id' <<< "$domain_summary")
    domain=$(api GET "/domains/${domain_id}")
  fi

  if [[ -n "$webhook_summary" ]]; then
    webhook_id=$(jq -r '.id' <<< "$webhook_summary")
    if [[ "$include_secrets" == "true" ]]; then
      webhook=$(api GET "/webhooks/${webhook_id}")
      webhook_signing_secret=$(jq -r '.signing_secret // ""' <<< "$webhook")
    else
      webhook=$webhook_summary
    fi
  fi

  if [[ -n "$runtime_key" ]]; then
    runtime_key_id=$(jq -r '.id' <<< "$runtime_key")
  fi

  if domain_is_desired "$domain" "$desired" \
    && webhook_is_desired "$webhook" "$desired" \
    && runtime_key_is_desired "$runtime_key" "$desired"; then
    matches="true"
    observed_hash=$desired_hash
  else
    observed_hash=$(
      jq -cn \
        --argjson domain "$domain" \
        --argjson webhook "$webhook" \
        --argjson runtime_key "${runtime_key:-null}" \
        '{domain:$domain,webhook:$webhook,runtime_key:$runtime_key}' \
        | sha256sum \
        | cut -d' ' -f1
    )
  fi

  jq -cn \
    --arg fingerprint "$observed_hash" \
    --arg matches "$matches" \
    --arg domain_id "$domain_id" \
    --arg webhook_id "$webhook_id" \
    --arg runtime_key_id "$runtime_key_id" \
    --arg webhook_signing_secret "$webhook_signing_secret" \
    '{
      fingerprint:$fingerprint,
      matches:$matches,
      domain_id:$domain_id,
      webhook_id:$webhook_id,
      runtime_key_id:$runtime_key_id,
      webhook_signing_secret:$webhook_signing_secret
    }'
}

reconcile() {
  local desired=$1
  local domain_name
  local domain_summary
  local domain_id
  local domain
  local runtime_key
  local endpoint
  local webhook
  local webhook_id
  local payload

  domain_name=$(jq -r '.domain.name' <<< "$desired")
  domain_summary=$(find_domain "$domain_name")
  if [[ -z "$domain_summary" ]]; then
    payload=$(jq -c '.domain' <<< "$desired")
    domain=$(api POST "/domains" "$payload")
    domain_id=$(jq -r '.id' <<< "$domain")
  else
    domain_id=$(jq -r '.id' <<< "$domain_summary")
    payload=$(
      jq -c '{
        open_tracking:.domain.open_tracking,
        click_tracking:.domain.click_tracking,
        tls:.domain.tls,
        capabilities:.domain.capabilities
      }' <<< "$desired"
    )
    api PATCH "/domains/${domain_id}" "$payload" >/dev/null
    domain=$(api GET "/domains/${domain_id}")
  fi

  if ! jq -e --argjson desired "$desired" '
    (
      [.records[] | {
        name,
        type,
        content: .value,
        priority: (.priority // null)
      }] | sort_by(.name, .type)
    ) == ($desired.dns_records | sort_by(.name, .type))
  ' <<< "$domain" >/dev/null; then
    echo "Resend returned DNS records that differ from the declared Cloudflare records." >&2
    echo "Update local.resend_dns_records before applying again." >&2
    exit 1
  fi

  if [[ $(jq -r '.status' <<< "$domain") != "verified" ]]; then
    api POST "/domains/${domain_id}/verify" '{}' >/dev/null
  fi

  runtime_key=$(find_runtime_key "$(jq -r '.runtime_key.id' <<< "$desired")")
  if [[ -z "$runtime_key" ]] || ! runtime_key_is_desired "$runtime_key" "$desired"; then
    echo "The declared Resend runtime API key is missing or renamed." >&2
    echo "Rotate the write-only token through the documented bootstrap workflow before applying." >&2
    exit 1
  fi

  endpoint=$(jq -r '.webhook.endpoint' <<< "$desired")
  webhook=$(find_webhook "$endpoint")
  payload=$(
    jq -c '{
      endpoint:.webhook.endpoint,
      events:.webhook.events,
      status:.webhook.status
    }' <<< "$desired"
  )
  if [[ -z "$webhook" ]]; then
    payload=$(jq 'del(.status)' <<< "$payload")
    api POST "/webhooks" "$payload" >/dev/null
  else
    webhook_id=$(jq -r '.id' <<< "$webhook")
    api PATCH "/webhooks/${webhook_id}" "$payload" >/dev/null
  fi
}

destroy() {
  local desired=$1
  local webhook
  local runtime_key
  local domain

  webhook=$(find_webhook "$(jq -r '.webhook.endpoint' <<< "$desired")")
  if [[ -n "$webhook" ]]; then
    api DELETE "/webhooks/$(jq -r '.id' <<< "$webhook")" >/dev/null
  fi

  runtime_key=$(find_runtime_key "$(jq -r '.runtime_key.id' <<< "$desired")")
  if [[ -n "$runtime_key" ]]; then
    api DELETE "/api-keys/$(jq -r '.id' <<< "$runtime_key")" >/dev/null
  fi

  domain=$(find_domain "$(jq -r '.domain.name' <<< "$desired")")
  if [[ -n "$domain" ]]; then
    api DELETE "/domains/$(jq -r '.id' <<< "$domain")" >/dev/null
  fi
}

case "$operation" in
  inspect)
    query=$(cat)
    desired=$(read_desired_json <<< "$query")
    include_secrets=$(jq -r '.include_secrets // "false"' <<< "$query")
    inspect "$desired" "$include_secrets"
    ;;
  reconcile)
    reconcile "$(read_desired_json)"
    ;;
  destroy)
    destroy "$(read_desired_json)"
    ;;
  *)
    echo "Usage: $0 {inspect|reconcile|destroy}" >&2
    exit 2
    ;;
esac

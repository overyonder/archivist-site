resource "cloudflare_turnstile_widget" "early_access" {
  account_id      = var.cloudflare_account_id
  name            = "Archivist early access"
  domains         = [local.site_domain]
  mode            = "managed"
  region          = "world"
  clearance_level = "no_clearance"
  bot_fight_mode  = false
  ephemeral_id    = false
  offlabel        = false
}

resource "cloudflare_zone_setting" "minimum_tls" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

resource "cloudflare_pages_project" "archivist" {
  account_id        = var.cloudflare_account_id
  name              = "archivist"
  production_branch = "main"
}

resource "cloudflare_pages_domain" "archivist" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.archivist.name
  name         = local.site_domain
}

resource "cloudflare_dns_record" "site" {
  zone_id = var.cloudflare_zone_id
  name    = local.site_domain
  type    = "CNAME"
  content = cloudflare_pages_project.archivist.subdomain
  ttl     = 1
  proxied = true
  comment = "Archivist production site; managed by OpenTofu."
}

# The Pages deployment deliberately publishes only the public site directory.
# Keep a second boundary at the edge so repository internals can never be
# served from the production hostname, including from a stale Pages cache.
resource "cloudflare_ruleset" "private_repository_paths" {
  zone_id     = var.cloudflare_zone_id
  name        = "Keep repository internals private"
  description = "Block infrastructure, functions, workflows, and repository metadata on the public site."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [{
    action      = "block"
    description = "Block repository-only paths"
    enabled     = true
    expression = join(" or ", [
      "starts_with(http.request.uri.path, \"/infrastructure/\")",
      "starts_with(http.request.uri.path, \"/supabase/\")",
      "starts_with(http.request.uri.path, \"/.github/\")",
      "http.request.uri.path in {\"/.gitignore\" \"/.assetsignore\" \"/AGENTS.md\" \"/README.md\"}",
    ])
  }]
}

check "turnstile_sitekey_is_published" {
  assert {
    condition     = strcontains(file("${path.module}/../early-access-form.js"), cloudflare_turnstile_widget.early_access.sitekey)
    error_message = "early-access-form.js must publish the site key owned by cloudflare_turnstile_widget.early_access."
  }
}

resource "cloudflare_dns_record" "ses_dkim" {
  # SES always issues three Easy DKIM tokens. Keep the OpenTofu instance keys
  # static so the graph can be planned before the identity has been created or
  # imported; only the record values need to remain unknown until apply.
  for_each = {
    for index in range(3) : tostring(index) =>
    aws_sesv2_email_identity.sending.dkim_signing_attributes[0].tokens[index]
  }

  zone_id = var.cloudflare_zone_id
  name    = "${each.value}._domainkey.${local.domain}"
  type    = "CNAME"
  content = "${each.value}.dkim.amazonses.com"
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "mail_from_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = local.mail_from_domain
  type     = "MX"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  priority = 10
  ttl      = 1
}

resource "cloudflare_dns_record" "mail_from_spf" {
  zone_id = var.cloudflare_zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  ttl     = 1
}

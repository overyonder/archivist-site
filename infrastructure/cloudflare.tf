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

resource "cloudflare_dns_record" "tracking" {
  zone_id = var.cloudflare_zone_id
  name    = local.tracking_domain
  type    = "CNAME"
  content = "r.${var.aws_region}.awstrack.me"
  ttl     = 1
  # Cloudflare terminates HTTPS for the branded tracking hostname before
  # proxying to SES; exposing the AWS target directly would not present a
  # certificate for links.over-yonder.tech.
  proxied = true
}

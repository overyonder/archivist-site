locals {
  resend_dns_records = [
    {
      name     = "resend._domainkey"
      type     = "TXT"
      content  = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDP2QVHEiQLA9uC5bHpgx0K0VLwdekgTFfLCXWKocZtOw26toMcKIRAn2NGrRXIZOrd+8Wuh6TQG5u2aw1baJ0PxHdHw32GLN617vGIdRvFVGzLAj6L+pLH45n+jj5suwdH92VXPbdljToZtroEKpxkEZogrOJtVHyuRMVYVs42mwIDAQAB"
      priority = null
    },
    {
      name     = "send"
      type     = "MX"
      content  = "feedback-smtp.us-east-1.amazonses.com"
      priority = 10
    },
    {
      name     = "send"
      type     = "TXT"
      content  = "v=spf1 include:amazonses.com ~all"
      priority = null
    },
  ]

  resend_desired = {
    domain = {
      name           = local.domain
      region         = "us-east-1"
      tls            = "enforced"
      open_tracking  = false
      click_tracking = false
      capabilities = {
        sending   = "enabled"
        receiving = "disabled"
      }
    }
    dns_records = local.resend_dns_records
    runtime_key = {
      id   = "f2f2a004-1b80-4fb4-bf2e-fac4abf5ebcb"
      name = "archivist-production"
    }
    webhook = {
      endpoint = "https://${supabase_project.archivist.id}.supabase.co/functions/v1/resend-events"
      events = [
        "email.sent",
        "email.delivered",
        "email.delivery_delayed",
        "email.bounced",
        "email.complained",
        "email.failed",
        "email.suppressed",
        "email.opened",
        "email.clicked",
      ]
      status = "enabled"
    }
  }
  resend_desired_json = jsonencode(local.resend_desired)
}

data "external" "resend_observed" {
  program = [
    "nix",
    "develop",
    "${path.module}#resend",
    "--command",
    "bash",
    "${path.module}/scripts/resend.sh",
    "inspect",
  ]

  query = {
    desired_json    = local.resend_desired_json
    include_secrets = "false"
  }
}

resource "terraform_data" "resend" {
  input = {
    desired_json = local.resend_desired_json
  }

  triggers_replace = [
    sha256(local.resend_desired_json),
    data.external.resend_observed.result.fingerprint,
    filesha256("${path.module}/scripts/resend.sh"),
    filesha256("${path.module}/flake.lock"),
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "nix develop ./infrastructure#resend --command bash infrastructure/scripts/resend.sh reconcile"

    environment = {
      RESEND_DESIRED_JSON = self.input.desired_json
    }
  }
}

data "external" "resend_effective" {
  depends_on = [terraform_data.resend]

  program = [
    "nix",
    "develop",
    "${path.module}#resend",
    "--command",
    "bash",
    "${path.module}/scripts/resend.sh",
    "inspect",
  ]

  query = {
    desired_json    = local.resend_desired_json
    include_secrets = "true"
  }
}

resource "cloudflare_dns_record" "resend_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "${local.resend_dns_records[0].name}.${local.domain}"
  type    = local.resend_dns_records[0].type
  content = local.resend_dns_records[0].content
  ttl     = 1
}

resource "cloudflare_dns_record" "resend_mail_from_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = "${local.resend_dns_records[1].name}.${local.domain}"
  type     = local.resend_dns_records[1].type
  content  = local.resend_dns_records[1].content
  priority = local.resend_dns_records[1].priority
  ttl      = 1
}

resource "cloudflare_dns_record" "resend_mail_from_spf" {
  zone_id = var.cloudflare_zone_id
  name    = "${local.resend_dns_records[2].name}.${local.domain}"
  type    = local.resend_dns_records[2].type
  content = local.resend_dns_records[2].content
  ttl     = 1
}

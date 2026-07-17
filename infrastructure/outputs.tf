output "turnstile_sitekey" {
  value = cloudflare_turnstile_widget.early_access.sitekey
}

output "supabase_function_base_url" {
  value = "https://${supabase_project.archivist.id}.supabase.co/functions/v1"
}

output "ses_dns_records" {
  value = {
    dkim      = [for record in cloudflare_dns_record.ses_dkim : record.name]
    mail_from = local.mail_from_domain
    tracking  = local.tracking_domain
  }
}

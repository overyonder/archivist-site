resource "random_password" "action_token_signing_key" {
  length  = 64
  special = false
}

resource "random_password" "internal_function_secret" {
  length  = 64
  special = false
}

resource "supabase_project" "archivist" {
  organization_id   = var.supabase_organization_id
  name              = "archivist-us"
  database_password = var.supabase_database_password
  region            = "us-east-1"
}

resource "supabase_settings" "archivist" {
  project_ref = supabase_project.archivist.id

  api = jsonencode({
    db_schema            = "public,storage,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })
}

locals {
  edge_function_files = fileset("${path.module}/../supabase/functions", "**")
  edge_function_checksum = sha256(join("", [
    for file in sort(tolist(local.edge_function_files)) :
    "${file}:${filesha256("${path.module}/../supabase/functions/${file}")}\n"
  ]))
}

resource "terraform_data" "edge_functions" {
  triggers_replace = [
    local.edge_function_checksum,
    filesha256("${path.module}/flake.lock"),
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "nix develop ./infrastructure#supabase --command supabase functions deploy --project-ref \"$SUPABASE_PROJECT_REF\" --import-map supabase/functions/deno.json --no-verify-jwt --use-api --yes"

    environment = {
      SUPABASE_PROJECT_REF = supabase_project.archivist.id
    }
  }
}

resource "supabase_edge_function_secrets" "archivist" {
  project_ref = supabase_project.archivist.id

  secrets = [
    { name = "ACTION_TOKEN_SIGNING_KEY", value = random_password.action_token_signing_key.result },
    { name = "ARCHIVIST_SITE_URL", value = "https://${local.site_domain}" },
    { name = "AWS_ACCESS_KEY_ID", value = aws_iam_access_key.edge.id },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "AWS_SECRET_ACCESS_KEY", value = aws_iam_access_key.edge.secret },
    { name = "EARLY_ACCESS_FORM_VERSION", value = "1" },
    { name = "EARLY_ACCESS_POLICY_VERSION", value = "2026-07-16" },
    { name = "INTERNAL_FUNCTION_SECRET", value = random_password.internal_function_secret.result },
    { name = "SES_CONFIGURATION_SET", value = aws_sesv2_configuration_set.early_access.configuration_set_name },
    { name = "SES_CONTACT_LIST_NAME", value = aws_sesv2_contact_list.early_access.contact_list_name },
    { name = "SES_FROM_EMAIL", value = "hello@${local.domain}" },
    { name = "SES_TOPIC_NAME", value = local.contact_topic_name },
    { name = "SNS_TOPIC_ARN", value = aws_sns_topic.ses_events.arn },
    { name = "TURNSTILE_SECRET_KEY", value = cloudflare_turnstile_widget.early_access.secret },
  ]
}

resource "aws_sesv2_configuration_set" "early_access" {
  configuration_set_name = local.configuration_set_name

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  tracking_options {
    custom_redirect_domain = local.tracking_domain
    https_policy           = "REQUIRE"
  }
}

resource "aws_sesv2_email_identity" "sending" {
  email_identity         = local.domain
  configuration_set_name = aws_sesv2_configuration_set.early_access.configuration_set_name
}

resource "aws_sesv2_email_identity_mail_from_attributes" "sending" {
  email_identity         = aws_sesv2_email_identity.sending.email_identity
  mail_from_domain       = local.mail_from_domain
  behavior_on_mx_failure = "REJECT_MESSAGE"
}

resource "aws_sesv2_account_suppression_attributes" "account" {
  suppressed_reasons = ["BOUNCE", "COMPLAINT"]
}

resource "aws_sesv2_contact_list" "early_access" {
  contact_list_name = local.contact_list_name
  description       = "Archivist early-access recipients"

  topic {
    topic_name                  = local.contact_topic_name
    display_name                = "Archivist early access"
    description                 = "Product development and release updates for people who joined Archivist early access."
    default_subscription_status = "OPT_OUT"
  }
}

resource "aws_sns_topic" "ses_events" {
  name = local.sns_topic_name
}

resource "aws_sns_topic_subscription" "supabase" {
  topic_arn              = aws_sns_topic.ses_events.arn
  protocol               = "https"
  endpoint               = "https://${supabase_project.archivist.id}.supabase.co/functions/v1/ses-events"
  endpoint_auto_confirms = false
}

resource "aws_sesv2_configuration_set_event_destination" "sns" {
  configuration_set_name = aws_sesv2_configuration_set.early_access.configuration_set_name
  event_destination_name = "archivist-early-access-sns"

  event_destination {
    enabled = true
    matching_event_types = [
      "BOUNCE",
      "CLICK",
      "COMPLAINT",
      "DELIVERY",
      "DELIVERY_DELAY",
      "OPEN",
      "REJECT",
      "RENDERING_FAILURE",
      "SEND",
      "SUBSCRIPTION",
    ]

    sns_destination {
      topic_arn = aws_sns_topic.ses_events.arn
    }
  }
}

# Deliberately retained full-scope administration identity for OpenTofu. Its
# long-lived key is encrypted in the workstation SOPS store; it has no console
# password and is not exposed to the Archivist runtime.
resource "aws_iam_user" "provisioner" {
  name = local.provisioner_user_name
}

resource "aws_iam_user_policy_attachment" "provisioner_administrator" {
  user       = aws_iam_user.provisioner.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

resource "aws_iam_access_key" "provisioner" {
  user = aws_iam_user.provisioner.name
}

data "aws_iam_policy_document" "edge" {
  statement {
    sid = "SendArchivistMail"
    actions = [
      "ses:SendEmail",
    ]
    resources = [
      aws_sesv2_email_identity.sending.arn,
      aws_sesv2_configuration_set.early_access.arn,
      replace(
        aws_sesv2_email_identity.sending.arn,
        "/${local.domain}",
        "/hello@${local.domain}",
      ),
    ]
  }

  statement {
    sid = "SynchronizeArchivistContacts"
    actions = [
      "ses:CreateContact",
      "ses:UpdateContact",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_user" "edge" {
  name = local.edge_user_name
}

resource "aws_iam_user_policy" "edge" {
  name   = "ArchivistEarlyAccessRuntime"
  user   = aws_iam_user.edge.name
  policy = data.aws_iam_policy_document.edge.json
}

resource "aws_iam_access_key" "edge" {
  user = aws_iam_user.edge.name
}

# Imported key still used by the Sydney project during migration. AWS does not
# expose an existing secret access key, so the US project receives the newly
# generated `edge` key above. Retire this key only after the US end-to-end test
# passes and the Sydney project is no longer serving signups.
resource "aws_iam_access_key" "edge_legacy" {
  user = aws_iam_user.edge.name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "Archivist AWS monthly spend"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.notification_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.notification_email]
  }
}

variable "state_passphrase" {
  description = "Passphrase used only to encrypt OpenTofu state and plan files."
  type        = string
  sensitive   = true
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "cloudflare_account_id" {
  type    = string
  default = "72b0273abc2a8ea96004ee8846c4d0a2"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for over-yonder.tech."
  type        = string
}

variable "supabase_organization_id" {
  description = "Organization slug that owns the Archivist Supabase project."
  type        = string
}

variable "supabase_database_password" {
  type      = string
  sensitive = true
}

variable "notification_email" {
  type    = string
  default = "hello@over-yonder.tech"
}

locals {
  domain                 = "over-yonder.tech"
  site_domain            = "archivist.over-yonder.tech"
  configuration_set_name = "archivist-early-access"
  contact_list_name      = "archivist-early-access"
  contact_topic_name     = "archivist-early-access"
  mail_from_domain       = "bounce.over-yonder.tech"
  tracking_domain        = "links.over-yonder.tech"
  sns_topic_name         = "archivist-early-access-events"
  provisioner_user_name  = "archivist-provisioner"
  edge_user_name         = "archivist-early-access-edge"

  tags = {
    Application = "Archivist"
    Environment = "production"
    ManagedBy   = "OpenTofu"
    Repository  = "overyonder/archivist-site"
  }
}

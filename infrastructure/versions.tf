terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.53"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.21"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.9"
    }
  }

  encryption {
    key_provider "pbkdf2" "state" {
      passphrase               = var.state_passphrase
      key_length               = 32
      iterations               = 600000
      salt_length              = 32
      hash_function            = "sha512"
      encrypted_metadata_alias = "archivist-infrastructure"
    }

    method "aes_gcm" "state" {
      keys = key_provider.pbkdf2.state
    }

    state {
      method   = method.aes_gcm.state
      enforced = true
    }

    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

provider "cloudflare" {}

provider "supabase" {}

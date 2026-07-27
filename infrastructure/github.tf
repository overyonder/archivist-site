resource "github_repository" "site" {
  name         = "archivist-site"
  description  = "The home of Archivist — a high-performance game preservation pipeline, browser, and launcher."
  homepage_url = "https://${local.site_domain}/"
  visibility   = "public"

  has_issues      = true
  has_projects    = true
  has_wiki        = false
  has_discussions = false

  allow_merge_commit          = true
  allow_squash_merge          = true
  allow_rebase_merge          = true
  allow_auto_merge            = false
  allow_update_branch         = false
  delete_branch_on_merge      = false
  web_commit_signoff_required = false

  archive_on_destroy = true

  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }

    secret_scanning_push_protection {
      status = "enabled"
    }
  }
}

resource "github_repository_vulnerability_alerts" "site" {
  repository = github_repository.site.name
  enabled    = true
}

resource "github_repository_dependabot_security_updates" "site" {
  repository = github_repository.site.name
  enabled    = true
}

resource "github_actions_repository_permissions" "site" {
  repository           = github_repository.site.name
  enabled              = true
  allowed_actions      = "selected"
  sha_pinning_required = true

  allowed_actions_config {
    github_owned_allowed = false
    verified_allowed     = false
    patterns_allowed = [
      "actions/checkout@*",
      "cloudflare/wrangler-action@*",
    ]
  }
}

resource "github_workflow_repository_permissions" "site" {
  repository                       = github_repository.site.name
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = false
}

resource "github_repository_environment" "production" {
  repository  = github_repository.site.name
  environment = "production"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "production_main" {
  repository     = github_repository.site.name
  environment    = github_repository_environment.production.environment
  branch_pattern = "main"
}

# Preserve direct pushes for this solo project while preventing destructive
# history rewrites and accidental deletion of the production branch.
resource "github_repository_ruleset" "main_history" {
  name        = "Protect main history"
  repository  = github_repository.site.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  rules {
    deletion         = true
    non_fast_forward = true
  }
}

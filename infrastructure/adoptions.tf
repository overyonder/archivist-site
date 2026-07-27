# Existing production resources are adopted rather than recreated. These
# declarative imports are intentionally retained as audit evidence and become
# no-ops after the resources are present in state.
import {
  to = cloudflare_pages_project.archivist
  id = "72b0273abc2a8ea96004ee8846c4d0a2/archivist"
}

import {
  to = cloudflare_pages_domain.archivist
  id = "72b0273abc2a8ea96004ee8846c4d0a2/archivist/archivist.over-yonder.tech"
}

import {
  to = cloudflare_dns_record.site
  id = "8fdf287a6f4b384a1b10462a3eab6d6c/46dc95dfe891433c29252316f967dadf"
}

import {
  to = github_repository.site
  id = "archivist-site"
}

import {
  to = github_repository_vulnerability_alerts.site
  id = "archivist-site"
}

import {
  to = github_repository_dependabot_security_updates.site
  id = "archivist-site"
}

import {
  to = github_actions_repository_permissions.site
  id = "archivist-site"
}

import {
  to = github_workflow_repository_permissions.site
  id = "archivist-site"
}

import {
  to = github_repository_environment.production
  id = "archivist-site:production"
}

import {
  to = github_repository_environment_deployment_policy.production_main
  id = "archivist-site:production:55711753"
}

import {
  to = github_repository_ruleset.main_history
  id = "archivist-site:19792562"
}

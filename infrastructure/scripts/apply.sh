#!/usr/bin/env bash
set -euo pipefail

infrastructure_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
site_repository=$(cd -- "$infrastructure_dir/.." && pwd)
state_file="$infrastructure_dir/terraform.tfstate"

git -C "$site_repository" diff --quiet --exit-code
git -C "$site_repository" diff --cached --quiet --exit-code

cd "$infrastructure_dir"
tofu apply "$@"

if ! command -v archivist-backup >/dev/null 2>&1; then
  echo "OpenTofu apply succeeded, but archivist-backup is not installed; state was not copied to TrueNAS." >&2
  exit 1
fi

archivist-backup state "$state_file"

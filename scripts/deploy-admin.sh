#!/usr/bin/env bash
set -euo pipefail
root=${1:?release root required}
sha=${2:?commit required}
project=${3:?compose project required}
[[ "$root" =~ ^/home/deploy/(dev|prod)/Hub/Admin$ && "$sha" =~ ^[a-f0-9]{40}$ && "$project" =~ ^singleton-admin-(dev|prod)$ ]]
release="$root/releases/$sha"
cd "$release"
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another Admin deployment is running'; exit 1; }
previous=$(readlink -f "$root/current" 2>/dev/null || true)
compose() { docker compose --project-name "$project" --env-file admin-release.env -f docker-compose.yml "$@"; }
rollback() {
  echo 'Admin health check failed; restoring previous release'
  if [[ -n "$previous" && "$previous" != "$release" && -f "$previous/admin-release.env" ]]; then
    cd "$previous"
    compose up -d --wait --wait-timeout 60
  else
    compose down
  fi
  exit 1
}
docker load -i admin-image.tar.gz
compose up -d --wait --wait-timeout 60 || rollback
# Verify auth API availability and contract as well as static serving.
# Root bootstrap readiness is separate and must be provisioned by the operator.
port=$(sed -n 's/^ADMIN_HOST_PORT=//p' admin-release.env)
[[ "$port" =~ ^[0-9]{1,5}$ ]]
if ! curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/api/admin/auth/session" | python3 -c 'import json,sys; v=json.load(sys.stdin); assert isinstance(v.get("gateAuthenticated"), bool) and isinstance(v.get("csrfToken"), str)'; then
  rollback
fi
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
echo 'Admin release healthy and activated'

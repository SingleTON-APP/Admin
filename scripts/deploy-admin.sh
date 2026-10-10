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
port=$(sed -n 's/^ADMIN_HOST_PORT=//p' admin-release.env)
[[ "$port" =~ ^[0-9]{1,5}$ ]] && (( port >= 1024 && port <= 65535 ))
command -v ss >/dev/null || { echo 'ss is required to check port ownership'; exit 1; }
if [[ -n "$(ss -H -ltn "sport = :$port")" ]]; then
  id=$(compose ps -q admin)
  owned_port=''
  if [[ -n "$id" ]]; then
    owned_port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$id" 2>/dev/null || true)
  fi
  [[ "$owned_port" == "$port" ]] || { echo "Admin port $port is occupied by another service; nothing changed"; exit 1; }
fi
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
image=$(sed -n 's/^ADMIN_IMAGE=//p' admin-release.env)
[[ "$image" =~ ^deployhubnetwork/admin:(prod|dev)-[a-f0-9]{40}$ ]] || { echo 'Invalid Admin image reference'; exit 1; }
# Свой раннер собрал образ на этом же сервере — тогда качать нечего.
attempt=1
until docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"; do
  if (( attempt >= 3 )); then
    echo "Unable to pull Admin image after $attempt attempts"
    exit 1
  fi
  echo "Admin image pull failed; retrying ($attempt/3)"
  attempt=$((attempt + 1))
  sleep 5
done
compose up -d --wait --wait-timeout 60 || rollback
# Verify auth API availability and contract as well as static serving.
# Root bootstrap readiness is separate and must be provisioned by the operator.
if ! curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/api/admin/auth/session" | python3 -c 'import json,sys; v=json.load(sys.stdin); assert isinstance(v.get("gateAuthenticated"), bool) and isinstance(v.get("csrfToken"), str)'; then
  rollback
fi
if ! curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/site-api/healthz" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status") == "ok"'; then
  rollback
fi
if [[ "$project" == singleton-admin-prod ]]; then
  # Verify the real HTTPS route without bypassing TLS certificate checks.
  if ! curl --fail --silent --show-error --max-time 15 'https://admin.hub-net.org/api/admin/auth/session' | python3 -c 'import json,sys; v=json.load(sys.stdin); assert isinstance(v.get("gateAuthenticated"), bool) and isinstance(v.get("csrfToken"), str)'; then
    echo "Public Admin routing is unhealthy; check nginx upstream 127.0.0.1:$port"
    rollback
  fi
fi
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
echo 'Admin release healthy and activated'

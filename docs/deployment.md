# Admin CI/CD

Adapted from Hub-core's SSH/Docker deployment scheme. This is a separate image,
compose project and server directory; it does not replace Web-Front.

## CI

`Admin CI` runs on PRs and pushes: npm ci, lint, typecheck, all tests, production
build, and Docker smoke checks for SPA routes, missing assets, API forwarding
and cache headers. Node 24 matches Vite requirements. Dist is retained as an
Actions artifact. Docker builds use package-lock.json, not yarn.lock.

## Deployment

`Deploy Admin` runs after successful push CI on main/develop; manual dispatch is
also available and validates lint/typecheck/tests first. Environments:
`production` for main and `development` for develop. Keep any desired environment
approval rules configured in GitHub. Feature/PR builds cannot deploy.

Environment variables (GitHub environment Variables) override the defaults:

| Variable                  | Default / meaning                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ADMIN_HOST_PORT           | Production: user-selected 12228. Development must specify its own free port.                               |
| ADMIN_BACKEND_UPSTREAM      | hub-backend-prod:5555 / hub-backend-dev:5555, matching Back-Hub compose.                     |
| ADMIN_SITE_BACKEND_UPSTREAM | hub-website-prod:3001 / hub-website-dev:3001, the content service on the shared Hub network. |
| SITE_PUBLIC_URL           | Website opened from the content editor; defaults to https://hub-net.org.                                   |
| ADMIN_DOCKER_NETWORK      | hub-prod-net / hub-dev-net, matching the existing backend workflows.                                       |

The server port is checked before replacing any container. An unrelated listener
on the selected port aborts the release. Docker also enforces exclusive binding.

Required environment secrets, matching the Hub-core naming scheme:
`PROD_SSH_HOST`, `PROD_SSH_PORT`, `PROD_SSH_USERNAME`, `PROD_SSH_PASSWORD`,
`PROD_SSH_KNOWN_HOSTS`; use `DEV_` names for development. KNOWN_HOSTS must contain
the trusted server's known_hosts entry, obtained and verified by the operator;
the workflow never silently trusts ssh-keyscan. Repository/org secrets must
actually grant Admin access; credentials from another repository are not copied.
`DOCKER_HUB_USERNAME` and `DOCKER_HUB_PASSWORD` are repository secrets used to
publish and pull the immutable `deployhubnetwork/admin:<tier>-<commit>` image.
Missing configuration fails before remote writes. No real secrets are committed.

Server requirements: Docker with compose plugin supporting --wait, curl,
python3, flock and ss, SSH access, the selected external network. Each release goes
into `/home/deploy/{prod|dev}/Hub/Admin/releases/<sha>` and uses compose project
`singleton-admin-{prod|dev}`. The runner publishes an immutable Docker Hub image,
transfers only the release metadata and scripts, logs the server into Docker Hub,
and the server pulls the image with retries. Static and real admin session API
health must pass before activation. Failure restores the previous release (or
removes the first failed Admin container). Release/current pointer updates only
on success. No other application's container is removed.

The server's public HTTPS virtual host must forward to the selected local Admin
port. The container serves /admin and other React routes with SPA fallback;
/api/* forwards to Back-Hub and /site-api/* forwards to the website content
service on the same browser origin. It never returns index
HTML for a missing JS asset or failed API request. index.html has no-store,
hashed assets have immutable caching.

Back-Hub must be deployed with the new auth endpoints and both migrations;
set ADMIN_WEB_ORIGIN to the exact public Admin origin and configure trusted
proxy IPs explicitly for IP lockout. Run the one-time root bootstrap separately,
using secret files. The frontend deployment never creates or resets accounts,
never injects passwords into VITE_ variables and never bypasses auth guards.

The requested production site is admin.hub-net.org. Its HTTPS virtual host must
proxy Admin routes to http://127.0.0.1:12228 (or the overridden port) while
preserving the existing TLS certificate settings. A production release also
checks the public auth API route; an unhealthy public route triggers rollback.

The production host configuration is versioned at
`nginx/admin.hub-net.org.conf`. It preserves the existing `10.100.0.0/24`
allowlist for both the HTTPS hostname and the VPN address while forwarding the
frontend to the Admin container on `127.0.0.1:12228`. `/api/*` is forwarded
directly to production Back-Hub on `127.0.0.1:12001`, so backend IP lockout sees
the host nginx proxy instead of a replaceable Admin container address.

## Local development

VITE_API_URL defaults to /api; Vite forwards /api to http://localhost:11001.
The content editor uses /site-api, forwarded locally to http://localhost:3001.
A published build never defaults to the visitor's localhost. Copy .env.example
if desired. A different public API origin can be passed at build time but
same-origin is recommended for HttpOnly SameSite=Strict admin cookies.

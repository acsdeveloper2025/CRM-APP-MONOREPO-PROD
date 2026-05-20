#!/usr/bin/env bash
# =============================================================================
# Staging deploy step — runs on the staging box, invoked by the GH Actions
# workflow over SSH. Idempotent: re-runs cleanly.
#
# Expects:
#   * /opt/crm-app/docker/ to exist with the repo checked out (bootstrap step)
#   * /opt/crm-app/docker/.env.staging present
#   * /opt/crm-app/docker/secrets/firebase-service-account.json present
#   * /etc/letsencrypt/live/crm.allcheckservices.com/ exists
#   * docker logged in to ghcr.io (workflow does this before invoking)
#
# Args (via env):
#   IMAGE_TAG    — image tag to pull. Default 'latest'. Workflow passes
#                  ${{ github.sha }} for immutable deploys.
# =============================================================================
set -euo pipefail

REPO_DIR="/opt/crm-app/docker"
COMPOSE_FILE="$REPO_DIR/infra/staging/docker-compose.yml"
ENV_FILE="$REPO_DIR/.env.staging"
IMAGE_TAG="${IMAGE_TAG:-latest}"

log() { printf '\033[34m▸\033[0m %s\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

log "deploy.sh starting — IMAGE_TAG=$IMAGE_TAG"

# ---- Preconditions ----------------------------------------------------------
[ -d "$REPO_DIR" ]      || die "repo dir missing: $REPO_DIR"
[ -f "$COMPOSE_FILE" ]  || die "compose file missing: $COMPOSE_FILE"
[ -f "$ENV_FILE" ]      || die ".env.staging missing: $ENV_FILE"
[ -f "$REPO_DIR/secrets/firebase-service-account.json" ] \
  || die "firebase secret missing: $REPO_DIR/secrets/firebase-service-account.json"
[ -f "/etc/letsencrypt/live/crm.allcheckservices.com/fullchain.pem" ] \
  || die "TLS cert missing — run certbot bootstrap first"

ok "preconditions OK"

cd "$REPO_DIR"

# ---- Pull latest repo state ------------------------------------------------
log "git pull"
git fetch --quiet origin
git reset --hard origin/main
ok "repo at $(git rev-parse --short HEAD)"

# ---- Load .env.staging into shell env --------------------------------------
# Compose v2's --env-file doesn't recursively expand ${VAR} references
# within the env file itself. Sourcing in bash with `set -a` exports all
# parsed values, which Compose then sees via shell environment (its
# highest-priority interpolation source).
log "sourcing $ENV_FILE into shell env"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
ok "env loaded"

# ---- Pull images -----------------------------------------------------------
log "docker compose pull"
IMAGE_TAG="$IMAGE_TAG" docker compose \
  -f "$COMPOSE_FILE" \
  pull
ok "images pulled"

# ---- Bring stack up --------------------------------------------------------
log "docker compose up -d --remove-orphans"
IMAGE_TAG="$IMAGE_TAG" docker compose \
  -f "$COMPOSE_FILE" \
  up -d --remove-orphans
ok "stack up"

# ---- Wait for healthy ------------------------------------------------------
log "waiting for healthy (max 180s)"
deadline=$(( $(date +%s) + 180 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if curl -fsS -o /dev/null http://localhost/_edge_health \
     && curl -fsS -o /dev/null http://localhost:3000/health 2>/dev/null \
        || docker compose -f "$COMPOSE_FILE" exec -T api wget -qO- http://localhost:3000/health >/dev/null 2>&1; then
    ok "edge + api responding"
    break
  fi
  sleep 5
done

# ---- Final smoke -----------------------------------------------------------
log "smoke: https://crm.allcheckservices.com/_edge_health"
if curl -fsS --max-time 10 https://crm.allcheckservices.com/_edge_health >/dev/null; then
  ok "external HTTPS healthcheck OK"
else
  # External fail isn't a hard error inside this script — could be transient
  # DNS/firewall. The workflow does its own end-to-end probe after this.
  printf '  \033[33m⚠\033[0m external HTTPS probe failed — investigate\n' >&2
fi

# ---- Prune dangling images (keep disk usage in check) ----------------------
log "docker image prune (dangling only)"
docker image prune -f >/dev/null
ok "prune done"

log "deploy.sh complete"

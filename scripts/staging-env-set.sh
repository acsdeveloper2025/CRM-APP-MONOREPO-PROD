#!/usr/bin/env bash
# =============================================================================
# staging-env-set.sh — manage env vars on the staging box without ssh+sed dance
#
# Usage:
#   ./scripts/staging-env-set.sh set    KEY value...
#   ./scripts/staging-env-set.sh unset  KEY
#   ./scripts/staging-env-set.sh get    KEY
#   ./scripts/staging-env-set.sh list
#
# Notes:
#   * Edits /opt/crm-app/docker/.env.staging in place via ssh.
#   * Re-runs `docker compose up -d` after set/unset so the changed value
#     reaches running containers. `get` and `list` are read-only.
#   * "value..." captures multi-word values (joined with single spaces) but
#     does NOT shell-evaluate, so RHS-${VAR} stays literal — Compose
#     interpolates at parse time, which is what we want.
#   * Existing KEY is replaced (not duplicated). Missing KEY on `set` is
#     appended. Comments/whitespace in the file are preserved.
# =============================================================================
set -euo pipefail

SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-49.50.119.155}"
SSH_PORT="${SSH_PORT:-2232}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/github_actions_key}"
REPO_DIR="${REPO_DIR:-/opt/crm-app/docker}"
ENV_FILE="$REPO_DIR/.env.staging"

ssh_run() {
  ssh -i "$SSH_KEY" -p "$SSH_PORT" \
      -o StrictHostKeyChecking=accept-new \
      -o BatchMode=yes \
      "$SSH_USER@$SSH_HOST" "$@"
}

valid_key() {
  [[ "$1" =~ ^[A-Z_][A-Z0-9_]*$ ]]
}

cmd="${1:-}"
case "$cmd" in
  set)
    key="${2:-}"; shift 2 2>/dev/null || true
    value="$*"
    valid_key "$key" || { echo "✗ KEY must be UPPER_SNAKE_CASE" >&2; exit 2; }
    [ -n "$value" ]  || { echo "✗ value missing" >&2; exit 2; }
    # Single-quoted file form: KEY='value'. Dotenv spec says single-quoted
    # values are LITERAL — no variable expansion, no escape processing.
    # That's what we want: storing exactly what was passed in. Compose
    # env_file + bash source both honor this.
    # Single-quotes inside the value need the standard close-quote +
    # escaped-quote + reopen-quote trick: ' → '\''.
    if [[ "$value" == *"'"* ]]; then
      echo "✗ value contains a single quote — not supported by this script." >&2
      echo "  rare in practice for env values; if you genuinely need one," >&2
      echo "  edit /opt/crm-app/docker/.env.staging by hand over SSH." >&2
      exit 2
    fi
    # base64-encode for ssh-transport safety. Remote decodes + writes.
    b64=$(printf '%s' "$value" | base64 | tr -d '\n')
    ssh_run "set -e
      raw=\$(printf '%s' '$b64' | base64 -d)
      line=\"${key}='\$raw'\"
      tmpfile=\$(mktemp)
      if grep -qE \"^${key}=\" '$ENV_FILE'; then
        awk -v key='${key}' -v repl=\"\$line\" '\$0 ~ \"^\" key \"=\" {print repl; next} {print}' '$ENV_FILE' > \"\$tmpfile\"
        mv \"\$tmpfile\" '$ENV_FILE'
        echo '  replaced ${key}'
      else
        printf '%s\n' \"\$line\" >> '$ENV_FILE'
        echo '  appended ${key}'
      fi
      chmod 600 '$ENV_FILE'
      cd '$REPO_DIR'
      set -a; source '$ENV_FILE'; set +a
      docker compose -f infra/staging/docker-compose.yml up -d 2>&1 | tail -5
    "
    ;;
  unset)
    key="${2:-}"
    valid_key "$key" || { echo "✗ KEY must be UPPER_SNAKE_CASE" >&2; exit 2; }
    ssh_run "set -e
      if grep -qE \"^${key}=\" '$ENV_FILE'; then
        sed -i \"/^${key}=/d\" '$ENV_FILE'
        echo '  removed ${key}'
        cd '$REPO_DIR'
        set -a; source '$ENV_FILE'; set +a
        docker compose -f infra/staging/docker-compose.yml up -d 2>&1 | tail -5
      else
        echo '  ${key} not present — nothing to do'
      fi
    "
    ;;
  get)
    key="${2:-}"
    valid_key "$key" || { echo "✗ KEY must be UPPER_SNAKE_CASE" >&2; exit 2; }
    # Strip the surrounding quotes if present (values written by `set` are
    # always single-quoted; values written manually may or may not be).
    ssh_run "grep -E \"^${key}=\" '$ENV_FILE' | sed -E \"s/^${key}=//; s/^'(.*)'\\\$/\\1/; s/^\\\"(.*)\\\"\\\$/\\1/\" || echo '(not set)'"
    ;;
  list)
    ssh_run "grep -E '^[A-Z_]+=' '$ENV_FILE' | sed 's/=.*$/=***/'"
    ;;
  *)
    cat >&2 <<USAGE
Usage:
  $0 set    KEY value...      # set/replace + restart api/worker
  $0 unset  KEY               # delete + restart api/worker
  $0 get    KEY               # print value (plaintext — careful in shared terminals)
  $0 list                     # list all keys, values masked

Env overrides (SSH target):
  SSH_USER (default: root)
  SSH_HOST (default: 49.50.119.155)
  SSH_PORT (default: 2232)
  SSH_KEY  (default: ~/.ssh/github_actions_key)
USAGE
    exit 2
    ;;
esac

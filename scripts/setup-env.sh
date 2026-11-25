#!/usr/bin/env bash
# Creates ./.env for docker compose with freshly generated secrets. Safe to re-run: existing secrets are kept.
#   ./scripts/setup-env.sh                       local machine (http://localhost:3000)
#   ./scripts/setup-env.sh --url https://x.y     any public URL (Codespaces does this automatically)
#   DOMAIN=estate.example.ng ./scripts/setup-env.sh --production
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${PUBLIC_URL:-}"
PRODUCTION=false
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --production) PRODUCTION=true; shift ;;
    *) echo "unknown option $1" >&2; exit 1 ;;
  esac
done

if [ -z "$URL" ] && [ -n "${CODESPACE_NAME:-}" ]; then
  URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi
if [ "$PRODUCTION" = true ]; then
  : "${DOMAIN:?set DOMAIN=your.domain}"
  URL="https://${DOMAIN}"
fi
URL="${URL:-http://localhost:3000}"
URL="${URL%/}"
HOST="${URL#*://}"

touch .env
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
put() {
  if grep -qE "^$1=" .env; then sed -i.bak "s#^$1=.*#$1=$2#" .env && rm -f .env.bak; else echo "$1=$2" >> .env; fi
}
rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

[ -n "$(get APP_KEY)" ] || put APP_KEY "base64:$(openssl rand -base64 32)"
[ -n "$(get DB_PASSWORD)" ] || put DB_PASSWORD "$(rand 32)"
[ -n "$(get DB_ROOT_PASSWORD)" ] || put DB_ROOT_PASSWORD "$(rand 32)"
put PUBLIC_URL "$URL"
put PUBLIC_HOST "$HOST"
case "$URL" in https://*) put SESSION_SECURE_COOKIE true ;; *) put SESSION_SECURE_COOKIE false ;; esac

if [ "$PRODUCTION" = true ]; then
  put DOMAIN "$DOMAIN"
  put APP_ENV production
  put SEED_DEMO_DATA false
  put MFA_ENFORCED true
  put MAIL_MAILER smtp
  echo "Production mode: set MAIL_HOST/MAIL_USERNAME/MAIL_PASSWORD, PAYSTACK_SECRET_KEY and INITIAL_ADMIN_EMAIL in .env"
else
  [ -n "$(get APP_ENV)" ] || put APP_ENV staging
  [ -n "$(get SEED_DEMO_DATA)" ] || put SEED_DEMO_DATA true
fi

chmod 600 .env
echo "Wrote .env for $URL"

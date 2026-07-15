#!/usr/bin/env bash
# ===========================================================================
# Plausible CE — one-shot setup helper (run ON THE VPS, in this directory).
#
# Generates .env from .env.example with the two secrets filled in and a random
# Postgres password wired through both DATABASE_URL and POSTGRES_PASSWORD, then
# brings the stack up. Prompts for the few values only you know (domain, Resend
# key). Safe to re-run: it will NOT overwrite an existing .env.
#
#   bash setup.sh
#
# After it finishes, follow README.md §4 to create the admin user and add the
# public site, then set the Vercel env vars (§6 / §6b).
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  echo "✋ .env already exists — refusing to overwrite. Edit it by hand or remove it first."
  exit 1
fi

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }
command -v docker  >/dev/null || { echo "docker is required"; exit 1; }

read -rp "Analytics domain (e.g. analytics.joostvandenbergh.com): " DOMAIN
read -rp "Bare gallery domain for MAILER_EMAIL (e.g. joostvandenbergh.com): " MAILDOMAIN
read -rsp "Resend API key (re_...), for transactional email — leave blank to skip: " RESEND_KEY
echo

SECRET_KEY_BASE="$(openssl rand -base64 48)"
TOTP_VAULT_KEY="$(openssl rand -base64 32)"
PGPASS="$(openssl rand -hex 24)"

# Start from the template, then substitute.
cp .env.example .env

# Fill values (portable sed -i usage via a temp file).
set_kv() { # key value
  local key="$1" val="$2"
  # Escape / and & for sed replacement.
  local esc; esc="$(printf '%s' "$val" | sed -e 's/[\/&]/\\&/g')"
  sed -i "s/^${key}=.*/${key}=${esc}/" .env
}

set_kv BASE_URL "https://${DOMAIN}"
set_kv SECRET_KEY_BASE "$SECRET_KEY_BASE"
set_kv TOTP_VAULT_KEY "$TOTP_VAULT_KEY"
set_kv POSTGRES_PASSWORD "$PGPASS"
set_kv DATABASE_URL "postgres://postgres:${PGPASS}@plausible_db:5432/plausible_db"
set_kv MAILER_EMAIL "analytics@${MAILDOMAIN}"
[[ -n "$RESEND_KEY" ]] && set_kv SMTP_USER_PWD "$RESEND_KEY"

# First run: open registration so the admin can be created (README §4).
set_kv DISABLE_REGISTRATION "false"
chmod 600 .env

echo "✅ .env written (registration temporarily OPEN for first-run admin creation)."
echo "→ Bringing the stack up…"
docker compose up -d

cat <<EOF

Next steps:
  1. Add the analytics.<domain> block from ../Caddyfile and reload Caddy
     (sudo systemctl reload caddy), so TLS + proxy are live.
  2. Visit https://${DOMAIN} and register the single admin user.
  3. In .env set DISABLE_REGISTRATION=true, then: docker compose up -d
  4. In Plausible → Add a website → ${MAILDOMAIN} (the PUBLIC site, not studio).
  5. Set the web Vercel env vars (README §6) and the studio Stats-API vars (§6b).
EOF

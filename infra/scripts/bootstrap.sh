#!/usr/bin/env bash
# ===========================================================================
# bootstrap.sh — provision the ENTIRE production stack from one machine.
#
#   Vultr VPS (self-hosted Supabase) + Vultr Object Storage + DNS
#   + Vercel (apps/studio, apps/web) + Sanity + Resend
#
# Automates infra/README.md §1–§4 and the Vercel/Sanity/Resend wiring from
# docs/BUILD_PLAN.md §2/§7. Driven entirely by environment variables — see
# bootstrap.README.md for the full input table and security notes.
#
# Usage:
#   VULTR_API_KEY=… VERCEL_TOKEN=… DOMAIN=… ADMIN_EMAIL=… GITHUB_REPO=owner/name \
#     bash infra/scripts/bootstrap.sh [--only <step>] [--from <step>] [--yes]
#
# IDEMPOTENT: every "create" first looks for the existing resource (by
# label/name) and re-uses it; generated secrets are created once and persisted
# in $STATE_DIR/secrets.env. Re-running after a partial failure is the
# intended recovery path.
#
# SECRETS ARE NEVER PRINTED — only variable names and where they are stored.
# ===========================================================================
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

# ---------------------------------------------------------------------------
# Tunables / defaults (overridable via env)
# ---------------------------------------------------------------------------
VULTR_REGION="${VULTR_REGION:-lhr}"
VULTR_PLAN="${VULTR_PLAN:-vhf-4c-8gb}"
SSH_PORT="${SSH_PORT:-2222}"
STATE_DIR="${STATE_DIR:-$REPO_ROOT/infra/scripts/.bootstrap-state}"
GIT_BRANCH="${GIT_BRANCH:-main}"
VERCEL_TEAM_ID="${VERCEL_TEAM_ID:-}"
SANITY_AUTH_TOKEN="${SANITY_AUTH_TOKEN:-}"
RESEND_API_KEY="${RESEND_API_KEY:-}"

INSTANCE_LABEL="jvb-supabase"
STORAGE_LABEL="jvb-storage"
SSHKEY_LABEL="jvb-bootstrap"
SANITY_PROJECT_NAME="JVB Gallery"
SANITY_DATASET="production"
VERCEL_PROJECT_STUDIO="jvb-studio"
VERCEL_PROJECT_WEB="jvb-web"

SECRETS_FILE="$STATE_DIR/secrets.env"
STATE_FILE="$STATE_DIR/state.env"
SSH_KEY_FILE="$STATE_DIR/id_ed25519"

STEPS=(secrets vultr_server vultr_storage dns provision configure stack_up
       migrate admin_user sanity vercel resend smoke summary)

ONLY_STEP=""
FROM_STEP=""
YES=0

# ---------------------------------------------------------------------------
# Logging — timestamps; NEVER pass secret values to these.
# ---------------------------------------------------------------------------
_ts()  { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
info() { printf '%s [info] %s\n' "$(_ts)" "$*"; }
warn() { printf '%s [WARN] %s\n' "$(_ts)" "$*" >&2; }
die()  { printf '%s [FAIL] %s\n' "$(_ts)" "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: bash infra/scripts/bootstrap.sh [options]

Options:
  --only <step>   run a single step (name with or without the step_ prefix)
  --from <step>   start at <step> and run everything after it
  --yes, -y       skip confirmation prompts / DNS wait loops
  --help, -h      this text

Steps, in order:
  ${STEPS[*]}

Required env: VULTR_API_KEY VERCEL_TOKEN DOMAIN ADMIN_EMAIL GITHUB_REPO
Optional env: SANITY_AUTH_TOKEN RESEND_API_KEY VERCEL_TEAM_ID VULTR_REGION
              VULTR_PLAN SSH_PORT STATE_DIR GIT_BRANCH
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY_STEP="${2:?--only needs a step name}"; shift 2 ;;
    --from) FROM_STEP="${2:?--from needs a step name}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done
ONLY_STEP="${ONLY_STEP#step_}"
FROM_STEP="${FROM_STEP#step_}"

step_exists() {
  local s
  for s in "${STEPS[@]}"; do [[ "$s" == "$1" ]] && return 0; done
  return 1
}
[[ -z "$ONLY_STEP" ]] || step_exists "$ONLY_STEP" || die "--only: unknown step '$ONLY_STEP' (valid: ${STEPS[*]})"
[[ -z "$FROM_STEP" ]] || step_exists "$FROM_STEP" || die "--from: unknown step '$FROM_STEP' (valid: ${STEPS[*]})"

# ---------------------------------------------------------------------------
# Input validation — clear table of what's missing.
# ---------------------------------------------------------------------------
preflight_env() {
  local missing=0
  local fmt='  %-20s %-10s %s\n'
  printf 'Inputs:\n'
  # shellcheck disable=SC2059
  printf "$fmt" 'VARIABLE' 'STATUS' 'NOTE'
  _req() { # name note
    if [[ -n "${!1:-}" ]]; then printf "$fmt" "$1" 'ok' "$2"
    else printf "$fmt" "$1" 'MISSING' "$2"; missing=1; fi
  }
  _opt() { # name note-if-absent
    if [[ -n "${!1:-}" ]]; then printf "$fmt" "$1" 'ok' '(optional)'
    else printf "$fmt" "$1" 'absent' "$2"; fi
  }
  _req VULTR_API_KEY  'required — Vultr API v2 (server, object storage, DNS)'
  _req VERCEL_TOKEN   'required — Vercel REST API (projects, env, domains)'
  _req DOMAIN         'required — base domain, e.g. jvb.example.com'
  _req ADMIN_EMAIL    'required — first studio admin user'
  _req GITHUB_REPO    'required — owner/name, for Vercel git linking'
  _opt SANITY_AUTH_TOKEN 'optional — Sanity steps will be SKIPPED'
  _opt RESEND_API_KEY    'optional — Resend + SMTP steps will be SKIPPED'
  _opt VERCEL_TEAM_ID    'optional — personal scope used'
  printf '  %-20s %-10s %s\n' 'VULTR_REGION' "$VULTR_REGION" '(default lhr)'
  printf '  %-20s %-10s %s\n' 'VULTR_PLAN' "$VULTR_PLAN" '(default vhf-4c-8gb)'
  printf '  %-20s %-10s %s\n' 'SSH_PORT' "$SSH_PORT" '(default 2222)'
  printf '  %-20s %-10s %s\n' 'STATE_DIR' "$STATE_DIR" ''
  [[ "$missing" -eq 0 ]] || die "missing required environment variables — see table above"

  [[ "$DOMAIN" != *"://"* && "$DOMAIN" != */* && "$DOMAIN" == *.* ]] \
    || die "DOMAIN must be a bare domain name (got something with scheme/slash or no dot)"
  [[ "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || die "GITHUB_REPO must be owner/name"
  [[ "$ADMIN_EMAIL" == *@* ]] || die "ADMIN_EMAIL does not look like an email address"
}

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
preflight_deps() {
  local c
  for c in curl jq ssh ssh-keygen scp openssl tar; do
    command -v "$c" >/dev/null 2>&1 || die "missing dependency: $c"
  done
  command -v node >/dev/null 2>&1 || die "missing dependency: node (>=18, used to sign the Supabase API-key JWTs)"
  local nv
  nv="$(node -p 'parseInt(process.versions.node, 10)')" || die "could not determine node version"
  [[ "$nv" -ge 18 ]] || die "node >= 18 required (found major version $nv)"
  if ! command -v rclone >/dev/null 2>&1; then
    warn "rclone not found — bucket creation will be skipped; manual instructions will be printed in step_vultr_storage"
  fi
  if ! command -v dig >/dev/null 2>&1 && ! command -v getent >/dev/null 2>&1; then
    warn "neither dig nor getent found — DNS resolution checks will be skipped"
  fi
}

# ---------------------------------------------------------------------------
# State + secrets persistence ($STATE_DIR, chmod 700; secrets.env chmod 600).
# Values are stored single-quoted; generators never emit single quotes.
# ---------------------------------------------------------------------------
init_state_dir() {
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  touch "$SECRETS_FILE" "$STATE_FILE"
  chmod 600 "$SECRETS_FILE" "$STATE_FILE"
  # The state dir holds live credentials — it must NEVER be committed.
  if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if ! git -C "$REPO_ROOT" check-ignore -q "$STATE_DIR" 2>/dev/null; then
      case "$STATE_DIR" in
        "$REPO_ROOT"/*) warn "STATE_DIR ($STATE_DIR) is inside the repo but NOT gitignored — add 'infra/scripts/.bootstrap-state/' to .gitignore before committing anything" ;;
      esac
    fi
  fi
}

_kv_get() { # file name -> value on stdout, rc 1 if absent
  local line
  line="$(grep -- "^$2='" "$1" 2>/dev/null | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1
  line="${line#*=}"; line="${line#\'}"; line="${line%\'}"
  printf '%s' "$line"
}
_kv_set() { # file name value
  case "$3" in *\'*) die "refusing to store value containing a single quote for $2" ;; esac
  local tmp="$1.tmp"
  grep -v -- "^$2='" "$1" > "$tmp" 2>/dev/null || true
  printf "%s='%s'\n" "$2" "$3" >> "$tmp"
  mv "$tmp" "$1"
  chmod 600 "$1"
}

secret_exists()  { _kv_get "$SECRETS_FILE" "$1" >/dev/null; }
get_secret()     { _kv_get "$SECRETS_FILE" "$1" || die "secret $1 not found in $SECRETS_FILE — run step_secrets first"; }
upsert_secret()  { _kv_set "$SECRETS_FILE" "$1" "$2"; }
get_state()      { _kv_get "$STATE_FILE" "$1"; }
set_state()      { _kv_set "$STATE_FILE" "$1" "$2"; }
require_state()  { _kv_get "$STATE_FILE" "$1" || die "state $1 not found in $STATE_FILE — run the earlier steps first"; }

ensure_secret() { # name generator-cmd [args…]
  local name="$1"; shift
  if secret_exists "$name"; then
    info "secret $name already present in secrets.env — keeping it"
    return 0
  fi
  local val
  val="$("$@")" || die "generator for $name failed"
  [[ -n "$val" ]] || die "generator for $name produced an empty value"
  upsert_secret "$name" "$val"
  info "generated $name -> stored in $SECRETS_FILE"
}

# URL-safe random token (base64 with +/ mapped to -_ and padding stripped, so
# the value is safe inside postgres:// URLs, basic-auth prompts and headers).
rand_token() { openssl rand -base64 "${1:-32}" | tr '+/' '-_' | tr -d '=\n'; }
rand_b64()   { openssl rand -base64 "${1:-48}" | tr -d '\n'; }

# HS256 Supabase API-key JWT signed with JWT_SECRET (10-year expiry).
gen_supabase_jwt() { # role: anon | service_role
  local role="$1"
  BOOTSTRAP_JWT_SECRET="$(get_secret JWT_SECRET)" node -e '
    const crypto = require("crypto");
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const header  = b64u({ alg: "HS256", typ: "JWT" });
    const payload = b64u({ role: process.argv[1], iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 3600 });
    const sig = crypto
      .createHmac("sha256", process.env.BOOTSTRAP_JWT_SECRET)
      .update(header + "." + payload)
      .digest("base64url");
    process.stdout.write(header + "." + payload + "." + sig);
  ' "$role"
}

# ---------------------------------------------------------------------------
# Generic HTTP helper — sets API_CODE / API_BODY, never aborts the script.
# ---------------------------------------------------------------------------
API_CODE=""
API_BODY=""
_api() { # METHOD URL BODY [header…]   (BODY may be "")
  local method="$1" url="$2" body="$3"
  shift 3
  local args=(-sS --max-time 120 -X "$method" "$url" -w $'\n%{http_code}')
  local h
  for h in "$@"; do args+=(-H "$h"); done
  [[ -z "$body" ]] || args+=(-H 'Content-Type: application/json' -d "$body")
  local resp
  if ! resp="$(curl "${args[@]}" 2>/dev/null)"; then
    API_CODE="000"; API_BODY=""
    return 0
  fi
  API_CODE="${resp##*$'\n'}"
  API_BODY="${resp%$'\n'*}"
  [[ "$API_BODY" != "$API_CODE" ]] || API_BODY=""
}
ok()  { [[ "$API_CODE" == 2* ]]; }
jqr() { jq -r "$1" <<<"$API_BODY"; }

vultr_api()  { _api "$1" "https://api.vultr.com/v2$2" "${3:-}" "Authorization: Bearer $VULTR_API_KEY"; }
sanity_api() { _api "$1" "https://api.sanity.io/v2021-06-07$2" "${3:-}" "Authorization: Bearer $SANITY_AUTH_TOKEN"; }
resend_api() { _api "$1" "https://api.resend.com$2" "${3:-}" "Authorization: Bearer $RESEND_API_KEY"; }
vercel_api() { # method path [body] — appends teamId when configured
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$VERCEL_TEAM_ID" ]]; then
    if [[ "$path" == *\?* ]]; then path="$path&teamId=$VERCEL_TEAM_ID"; else path="$path?teamId=$VERCEL_TEAM_ID"; fi
  fi
  _api "$method" "https://api.vercel.com$path" "$body" "Authorization: Bearer $VERCEL_TOKEN"
}

# ---------------------------------------------------------------------------
# SSH helpers — dedicated key + known_hosts inside STATE_DIR.
# ---------------------------------------------------------------------------
ssh_opts() {
  printf '%s\n' \
    -i "$SSH_KEY_FILE" \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=10 \
    -o UserKnownHostsFile="$STATE_DIR/known_hosts" \
    -o IdentitiesOnly=yes \
    -o BatchMode=yes \
    -o LogLevel=ERROR
}
ssh_root() { # [command…] — root on port 22 (pre-hardening only)
  local ip; ip="$(require_state INSTANCE_IP)"
  local opts=(); mapfile -t opts < <(ssh_opts)
  ssh "${opts[@]}" -p 22 "root@$ip" "$@"
}
ssh_deploy() { # [command…] — deploy on $SSH_PORT (post-hardening)
  local ip; ip="$(require_state INSTANCE_IP)"
  local opts=(); mapfile -t opts < <(ssh_opts)
  ssh "${opts[@]}" -p "$SSH_PORT" "deploy@$ip" "$@"
}
scp_root() { # local-file… (copied to root@ip:)
  local ip; ip="$(require_state INSTANCE_IP)"
  local opts=(); mapfile -t opts < <(ssh_opts)
  scp -q "${opts[@]}" -P 22 "$@" "root@$ip:"
}

# psql inside the db container, SQL on stdin, rows on stdout.
remote_psql() {
  ssh_deploy 'docker compose -f /opt/jvb/infra/compose/docker-compose.yml exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq'
}

resolve_a() { # hostname -> first A record (empty if unresolvable)
  local host="$1"
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$host" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true
  elif command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "$host" 2>/dev/null | awk '{ print $1; exit }' || true
  fi
}

# ===========================================================================
# step_secrets — generate every secret ONCE into $STATE_DIR/secrets.env.
# ===========================================================================
step_secrets() {
  ensure_secret POSTGRES_PASSWORD        rand_token 24     # url-safe: goes into postgres:// URLs
  ensure_secret JWT_SECRET               rand_b64 48
  ensure_secret SYNC_SHARED_SECRET       rand_token 32
  ensure_secret CRON_SECRET              rand_token 32
  ensure_secret SANITY_REVALIDATE_SECRET rand_token 32
  ensure_secret STUDIO_DASH_PASSWORD     rand_token 24
  ensure_secret ADMIN_PASSWORD           rand_token 18
  ensure_secret ANON_KEY                 gen_supabase_jwt anon
  ensure_secret SERVICE_ROLE_KEY         gen_supabase_jwt service_role

  if [[ ! -f "$SSH_KEY_FILE" ]]; then
    ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N '' -C 'jvb-bootstrap' -q
    info "generated SSH keypair -> $SSH_KEY_FILE"
  else
    info "SSH keypair already present at $SSH_KEY_FILE"
  fi
}

# ===========================================================================
# step_vultr_server — upsert SSH key, upsert instance, wait for active + IP.
# ===========================================================================
step_vultr_server() {
  local pub kid
  pub="$(cat "$SSH_KEY_FILE.pub")"

  vultr_api GET "/ssh-keys?per_page=500"
  ok || die "Vultr GET /ssh-keys failed (HTTP $API_CODE): $API_BODY"
  kid="$(jq -r --arg n "$SSHKEY_LABEL" '[.ssh_keys[] | select(.name == $n)][0].id // empty' <<<"$API_BODY")"
  if [[ -n "$kid" ]]; then
    local remote_key
    remote_key="$(jq -r --arg n "$SSHKEY_LABEL" '[.ssh_keys[] | select(.name == $n)][0].ssh_key // empty' <<<"$API_BODY")"
    if [[ "$remote_key" != "$pub" ]]; then
      warn "Vultr SSH key '$SSHKEY_LABEL' differs from local keypair — updating it to match $SSH_KEY_FILE.pub"
      vultr_api PATCH "/ssh-keys/$kid" "$(jq -n --arg k "$pub" --arg n "$SSHKEY_LABEL" '{name: $n, ssh_key: $k}')"
      ok || die "Vultr PATCH /ssh-keys/$kid failed (HTTP $API_CODE): $API_BODY"
    fi
    info "re-using Vultr SSH key '$SSHKEY_LABEL' ($kid)"
  else
    vultr_api POST "/ssh-keys" "$(jq -n --arg n "$SSHKEY_LABEL" --arg k "$pub" '{name: $n, ssh_key: $k}')"
    ok || die "Vultr POST /ssh-keys failed (HTTP $API_CODE): $API_BODY"
    kid="$(jqr '.ssh_key.id')"
    info "created Vultr SSH key '$SSHKEY_LABEL' ($kid)"
  fi
  set_state VULTR_SSHKEY_ID "$kid"

  local iid
  vultr_api GET "/instances?per_page=500&label=$INSTANCE_LABEL"
  ok || die "Vultr GET /instances failed (HTTP $API_CODE): $API_BODY"
  iid="$(jq -r --arg l "$INSTANCE_LABEL" '[.instances[] | select(.label == $l)][0].id // empty' <<<"$API_BODY")"

  if [[ -n "$iid" ]]; then
    info "re-using instance '$INSTANCE_LABEL' ($iid)"
  else
    vultr_api GET "/os?per_page=500"
    ok || die "Vultr GET /os failed (HTTP $API_CODE): $API_BODY"
    local osid
    osid="$(jqr '[.os[] | select((.name | contains("Ubuntu 24.04")) and (.name | contains("x64")))][0].id // empty')"
    [[ -n "$osid" ]] || die "could not find 'Ubuntu 24.04 … x64' in Vultr GET /v2/os — pick the os_id manually"
    local body
    body="$(jq -n --arg r "$VULTR_REGION" --arg p "$VULTR_PLAN" --argjson os "$osid" \
                  --arg l "$INSTANCE_LABEL" --arg k "$kid" \
      '{region: $r, plan: $p, os_id: $os, label: $l, hostname: $l,
        sshkey_id: [$k], backups: "disabled", enable_ipv6: false}')"
    vultr_api POST "/instances" "$body"
    ok || die "Vultr POST /instances failed (HTTP $API_CODE): $API_BODY"
    iid="$(jqr '.instance.id')"
    info "created instance '$INSTANCE_LABEL' ($iid) — $VULTR_PLAN in $VULTR_REGION"
  fi
  set_state INSTANCE_ID "$iid"

  info "waiting for instance to become active with a public IP (up to 15 min)…"
  local deadline=$(( SECONDS + 900 )) status ip
  while :; do
    vultr_api GET "/instances/$iid"
    ok || die "Vultr GET /instances/$iid failed (HTTP $API_CODE): $API_BODY"
    status="$(jqr '.instance.status // empty')"
    ip="$(jqr '.instance.main_ip // empty')"
    if [[ "$status" == "active" && -n "$ip" && "$ip" != "0.0.0.0" ]]; then break; fi
    [[ "$SECONDS" -lt "$deadline" ]] || die "timed out waiting for instance $iid (status=$status ip=$ip)"
    sleep 10
  done
  set_state INSTANCE_IP "$ip"
  info "instance active: $ip"
}

# ===========================================================================
# step_vultr_storage — upsert Object Storage, save keys, create buckets.
# ===========================================================================
step_vultr_storage() {
  local sid
  vultr_api GET "/object-storage?per_page=500"
  ok || die "Vultr GET /object-storage failed (HTTP $API_CODE): $API_BODY"
  sid="$(jq -r --arg l "$STORAGE_LABEL" '[.object_storages[] | select(.label == $l)][0].id // empty' <<<"$API_BODY")"

  if [[ -n "$sid" ]]; then
    info "re-using object storage '$STORAGE_LABEL' ($sid)"
  else
    vultr_api GET "/object-storage/clusters?per_page=500"
    ok || die "Vultr GET /object-storage/clusters failed (HTTP $API_CODE): $API_BODY"
    local cid
    cid="$(jq -r --arg r "$VULTR_REGION" \
      '([.clusters[] | select(.region == $r or (.hostname | contains($r)))][0].id // .clusters[0].id)' <<<"$API_BODY")"
    [[ -n "$cid" && "$cid" != "null" ]] || die "no object-storage cluster found"
    vultr_api POST "/object-storage" "$(jq -n --argjson c "$cid" --arg l "$STORAGE_LABEL" '{cluster_id: $c, label: $l}')"
    if ! ok && grep -qi 'tier' <<<"$API_BODY"; then
      # Newer Vultr API variants require a tier_id — retry with the first tier.
      warn "object-storage create wants a tier_id — retrying with the cluster's first tier"
      vultr_api GET "/object-storage/clusters/$cid/tiers"
      local tid
      tid="$(jqr '.tiers[0].id // empty')"
      [[ -n "$tid" ]] || die "could not determine a tier_id for cluster $cid: $API_BODY"
      vultr_api POST "/object-storage" "$(jq -n --argjson c "$cid" --argjson t "$tid" --arg l "$STORAGE_LABEL" '{cluster_id: $c, tier_id: $t, label: $l}')"
    fi
    ok || die "Vultr POST /object-storage failed (HTTP $API_CODE): $API_BODY"
    sid="$(jqr '.object_storage.id')"
    info "created object storage '$STORAGE_LABEL' ($sid)"
  fi
  set_state S3_ID "$sid"

  info "waiting for object storage to become active…"
  local deadline=$(( SECONDS + 600 )) st host akey skey
  while :; do
    vultr_api GET "/object-storage/$sid"
    ok || die "Vultr GET /object-storage/$sid failed (HTTP $API_CODE): $API_BODY"
    st="$(jqr '.object_storage.status // empty')"
    [[ "$st" == "active" ]] && break
    [[ "$SECONDS" -lt "$deadline" ]] || die "timed out waiting for object storage $sid (status=$st)"
    sleep 10
  done
  host="$(jqr '.object_storage.s3_hostname')"
  akey="$(jqr '.object_storage.s3_access_key')"
  skey="$(jqr '.object_storage.s3_secret_key')"
  [[ -n "$host" && -n "$akey" && -n "$skey" ]] || die "object storage $sid returned no s3_hostname/keys"
  set_state S3_HOSTNAME "$host"
  upsert_secret VULTR_S3_ACCESS_KEY "$akey"
  upsert_secret VULTR_S3_SECRET_KEY "$skey"
  info "object storage endpoint: https://$host (keys stored in secrets.env as VULTR_S3_ACCESS_KEY/VULTR_S3_SECRET_KEY)"

  # Buckets: jvb-storage (storage-api), jvb-storage-replica, jvb-backups.
  if command -v rclone >/dev/null 2>&1; then
    local b out
    for b in jvb-storage jvb-storage-replica jvb-backups; do
      if out="$(RCLONE_CONFIG_JVB_TYPE=s3 \
                RCLONE_CONFIG_JVB_PROVIDER=Other \
                RCLONE_CONFIG_JVB_ACCESS_KEY_ID="$akey" \
                RCLONE_CONFIG_JVB_SECRET_ACCESS_KEY="$skey" \
                RCLONE_CONFIG_JVB_ENDPOINT="https://$host" \
                rclone mkdir "jvb:$b" 2>&1)"; then
        info "bucket $b ok"
      elif grep -qiE 'BucketAlreadyExists|BucketAlreadyOwnedByYou|already exists' <<<"$out"; then
        info "bucket $b already exists"
      else
        warn "rclone mkdir jvb:$b failed: $out"
      fi
    done
  else
    warn "rclone missing — create the buckets manually (Vultr dashboard → Object Storage → '$STORAGE_LABEL' → Buckets):"
    warn "  jvb-storage           (storage-api backend)"
    warn "  jvb-storage-replica   (weekly sync target)"
    warn "  jvb-backups           (pg dumps)"
  fi
}

# ===========================================================================
# step_dns — api.$DOMAIN + db-admin.$DOMAIN → instance IP (Vultr DNS if the
# zone is managed there; otherwise print records + wait for resolution).
# ===========================================================================
find_vultr_zone() { # prints the managed zone (DOMAIN or a registrable parent), rc 1 if none
  vultr_api GET "/domains?per_page=500"
  ok || { warn "Vultr GET /domains failed (HTTP $API_CODE)"; return 1; }
  local zones cand
  zones="$(jqr '.domains[].domain')"
  cand="$DOMAIN"
  while [[ "$cand" == *.* ]]; do
    if grep -qxF -- "$cand" <<<"$zones"; then printf '%s' "$cand"; return 0; fi
    cand="${cand#*.}"
  done
  return 1
}

rel_name() { # fqdn zone -> record name relative to zone ("" for the apex)
  local fq="$1" zone="$2"
  if [[ "$fq" == "$zone" ]]; then printf ''; else printf '%s' "${fq%".$zone"}"; fi
}

upsert_vultr_record() { # zone name type data [priority]
  local zone="$1" name="$2" type="$3" data="$4" prio="${5:-}"
  vultr_api GET "/domains/$zone/records?per_page=500"
  ok || { warn "cannot list DNS records for $zone (HTTP $API_CODE)"; return 1; }
  local rid cur
  rid="$(jq -r --arg n "$name" --arg t "$type" '[.records[] | select(.name == $n and .type == $t)][0].id // empty' <<<"$API_BODY")"
  cur="$(jq -r --arg n "$name" --arg t "$type" '[.records[] | select(.name == $n and .type == $t)][0].data // empty' <<<"$API_BODY")"
  local body
  if [[ -n "$prio" ]]; then
    body="$(jq -n --arg n "$name" --arg t "$type" --arg d "$data" --argjson p "$prio" '{name: $n, type: $t, data: $d, ttl: 300, priority: $p}')"
  else
    body="$(jq -n --arg n "$name" --arg t "$type" --arg d "$data" '{name: $n, type: $t, data: $d, ttl: 300}')"
  fi
  if [[ -n "$rid" ]]; then
    if [[ "$cur" == "$data" ]]; then
      info "DNS $type ${name:-@}.$zone already correct"
      return 0
    fi
    vultr_api PATCH "/domains/$zone/records/$rid" "$body"
  else
    vultr_api POST "/domains/$zone/records" "$body"
  fi
  if ok; then info "DNS $type ${name:-@}.$zone -> $data"
  else warn "DNS upsert for $type ${name:-@}.$zone failed (HTTP $API_CODE): $API_BODY"; fi
}

step_dns() {
  local ip zone
  ip="$(require_state INSTANCE_IP)"
  if zone="$(find_vultr_zone)"; then
    info "Vultr manages DNS zone '$zone'"
    set_state DNS_ZONE "$zone"
    upsert_vultr_record "$zone" "$(rel_name "api.$DOMAIN" "$zone")" A "$ip"
    upsert_vultr_record "$zone" "$(rel_name "db-admin.$DOMAIN" "$zone")" A "$ip"
    info "note: $DOMAIN / www.$DOMAIN / admin.$DOMAIN point at Vercel and are created in step_vercel"
  else
    set_state DNS_ZONE ""
    warn "no Vultr DNS zone found for $DOMAIN — create these records at your DNS provider NOW:"
    warn "  api.$DOMAIN        A  $ip"
    warn "  db-admin.$DOMAIN   A  $ip"
    warn "(Vercel + Resend records will be printed later in step_vercel / step_resend)"
    if [[ "$YES" -ne 1 ]]; then
      info "waiting up to 15 min for api.$DOMAIN to resolve to $ip (Ctrl-C to abort; --yes skips this wait)…"
      local deadline=$(( SECONDS + 900 )) got=""
      while [[ "$SECONDS" -lt "$deadline" ]]; do
        got="$(resolve_a "api.$DOMAIN")"
        [[ "$got" == "$ip" ]] && break
        sleep 20
      done
    fi
  fi
  local got
  got="$(resolve_a "api.$DOMAIN")"
  if [[ "$got" == "$ip" ]]; then
    info "api.$DOMAIN resolves to $ip"
  else
    warn "api.$DOMAIN does not (yet) resolve to $ip (got '${got:-nothing}') — Caddy cannot obtain TLS certificates until it does"
  fi
}

# ===========================================================================
# step_provision — run provision.sh as root, install root-only helpers,
# then verify deploy@:$SSH_PORT works.
#
# provision.sh copies root's authorized_keys to the deploy user, so our
# generated key (installed at instance creation) carries over. It does NOT
# grant deploy any passwordless sudo (deploy has no password at all), so the
# Caddyfile installer helper + sudoers rule are installed here, in the same
# root session, BEFORE root access is lost to the SSH hardening.
# ===========================================================================
write_post_provision_script() { # outfile
  cat > "$1" <<'POSTEOF'
#!/usr/bin/env bash
# post-provision.sh — root-only extras for bootstrap.sh (idempotent).
set -euo pipefail
install -d -o deploy -g deploy /opt/jvb
cat > /usr/local/bin/jvb-install-caddyfile <<'HLP'
#!/usr/bin/env bash
# Installs /home/deploy/Caddyfile.rendered as the live Caddyfile.
# The ONLY command the deploy user may run as root (see sudoers.d/deploy-caddy).
set -euo pipefail
src="/home/deploy/Caddyfile.rendered"
[[ -f "$src" ]] || { echo "missing $src" >&2; exit 1; }
caddy validate --config "$src" --adapter caddyfile
install -m 644 -o root -g root "$src" /etc/caddy/Caddyfile
systemctl reload caddy
HLP
chmod 755 /usr/local/bin/jvb-install-caddyfile
printf 'deploy ALL=(root) NOPASSWD: /usr/local/bin/jvb-install-caddyfile\n' > /etc/sudoers.d/deploy-caddy
chmod 440 /etc/sudoers.d/deploy-caddy
visudo -c >/dev/null
echo "post-provision extras installed"
POSTEOF
  chmod 700 "$1"
}

ensure_server_helpers() {
  if ssh_deploy 'test -x /usr/local/bin/jvb-install-caddyfile && test -d /opt/jvb' 2>/dev/null; then
    return 0
  fi
  warn "server helpers missing (box provisioned outside bootstrap?) — trying root@:22"
  if ssh_root true 2>/dev/null; then
    write_post_provision_script "$STATE_DIR/post-provision.sh"
    scp_root "$STATE_DIR/post-provision.sh"
    ssh_root 'bash post-provision.sh'
  else
    warn "no root access — run this ONCE as root on the server:"
    warn "  install -d -o deploy -g deploy /opt/jvb   # plus the jvb-install-caddyfile helper + sudoers rule"
    warn "  (see write_post_provision_script in infra/scripts/bootstrap.sh for the exact contents)"
  fi
}

step_provision() {
  local ip
  ip="$(require_state INSTANCE_IP)"

  if ssh_deploy true 2>/dev/null; then
    info "deploy@$ip:$SSH_PORT already reachable — provisioning previously completed, skipping"
    ensure_server_helpers
    return 0
  fi

  info "waiting for root SSH on $ip:22 (fresh instance boot; up to 10 min)…"
  local i reached=0
  for (( i = 0; i < 60; i++ )); do
    if ssh_root true 2>/dev/null; then reached=1; break; fi
    sleep 10
  done
  [[ "$reached" -eq 1 ]] || die "cannot reach root@$ip:22 nor deploy@$ip:$SSH_PORT — check the instance in the Vultr console"

  write_post_provision_script "$STATE_DIR/post-provision.sh"
  scp_root "$REPO_ROOT/infra/scripts/provision.sh" "$STATE_DIR/post-provision.sh"
  info "running provision.sh (SSH_PORT=$SSH_PORT) + post-provision extras as root…"
  # One session: provision.sh moves sshd to $SSH_PORT and disables root login
  # mid-script, but the established connection survives, so the extras still
  # run as root. New root connections are impossible afterwards — by design.
  ssh_root "SSH_PORT=$SSH_PORT bash provision.sh && bash post-provision.sh"

  info "verifying deploy@$ip:$SSH_PORT…"
  reached=0
  for (( i = 0; i < 18; i++ )); do
    if ssh_deploy true 2>/dev/null; then reached=1; break; fi
    sleep 5
  done
  [[ "$reached" -eq 1 ]] || die "deploy SSH verification FAILED — do not lose the Vultr web console; investigate before re-running"
  info "provisioning complete — deploy@$ip:$SSH_PORT works"
}

# ===========================================================================
# step_configure — ship the repo subtree to /opt/jvb, render compose/.env and
# the Caddyfile with real values, install + reload Caddy.
# ===========================================================================
render_compose_env() { # outfile — renders infra/compose/.env.example
  local out="$1" s3host k
  s3host="$(require_state S3_HOSTNAME)"
  # get_secret dies inside $() below, which cannot abort an array assignment —
  # so verify everything exists up front.
  for k in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY \
           VULTR_S3_ACCESS_KEY VULTR_S3_SECRET_KEY STUDIO_DASH_PASSWORD; do
    secret_exists "$k" || die "secret $k missing — run step_secrets / step_vultr_storage first"
  done
  declare -A ov=(
    [POSTGRES_PASSWORD]="$(get_secret POSTGRES_PASSWORD)"
    [JWT_SECRET]="$(get_secret JWT_SECRET)"
    [ANON_KEY]="$(get_secret ANON_KEY)"
    [SERVICE_ROLE_KEY]="$(get_secret SERVICE_ROLE_KEY)"
    [SITE_URL]="https://admin.$DOMAIN"
    [API_EXTERNAL_URL]="https://api.$DOMAIN"
    [ADDITIONAL_REDIRECT_URLS]="https://admin.$DOMAIN"
    [DISABLE_SIGNUP]="true"
    [SMTP_ADMIN_EMAIL]="auth@$DOMAIN"
    [VULTR_S3_ENDPOINT]="https://$s3host"
    [VULTR_S3_REGION]="${s3host%%.*}"
    [VULTR_S3_BUCKET]="jvb-storage"
    [VULTR_S3_ACCESS_KEY]="$(get_secret VULTR_S3_ACCESS_KEY)"
    [VULTR_S3_SECRET_KEY]="$(get_secret VULTR_S3_SECRET_KEY)"
    [STUDIO_PASSWORD]="$(get_secret STUDIO_DASH_PASSWORD)"
  )
  if [[ -n "$RESEND_API_KEY" ]]; then
    ov[SMTP_PASS]="$RESEND_API_KEY"
  else
    warn "RESEND_API_KEY not set — SMTP_PASS stays a placeholder; GoTrue auth emails will NOT send until you set it in /opt/jvb/infra/compose/.env"
  fi

  : > "$out"
  chmod 600 "$out"
  local line key
  while IFS= read -r line; do
    if [[ "$line" =~ ^([A-Z][A-Z0-9_]*)= ]]; then
      key="${BASH_REMATCH[1]}"
      if [[ -n "${ov[$key]+x}" ]]; then
        printf '%s=%s\n' "$key" "${ov[$key]}" >> "$out"
        continue
      fi
    fi
    printf '%s\n' "$line" >> "$out"
  done < "$REPO_ROOT/infra/compose/.env.example"

  # Every CHANGE_ME must be gone (SMTP_PASS tolerated when Resend is absent).
  local leftovers
  leftovers="$(grep -E '^[A-Z][A-Z0-9_]*=.*CHANGE_ME' "$out" | cut -d= -f1 || true)"
  if [[ -n "$leftovers" ]]; then
    if [[ "$leftovers" == "SMTP_PASS" && -z "$RESEND_API_KEY" ]]; then
      warn "leaving SMTP_PASS unset (no RESEND_API_KEY)"
    else
      die "unrendered CHANGE_ME values remain in the generated .env: $(printf '%s ' "$leftovers")"
    fi
  fi
}

step_configure() {
  local ip
  ip="$(require_state INSTANCE_IP)"

  info "copying infra/compose, infra/image-worker, infra/scripts, packages/config, supabase/migrations -> /opt/jvb"
  tar -C "$REPO_ROOT" -cz \
      --exclude='node_modules' --exclude='.turbo' --exclude='.next' --exclude='.bootstrap-state' \
      infra/compose infra/image-worker infra/scripts packages/config supabase/migrations \
    | ssh_deploy 'mkdir -p /opt/jvb && tar xz -C /opt/jvb'

  info "rendering /opt/jvb/infra/compose/.env"
  render_compose_env "$STATE_DIR/compose.env.rendered"
  ssh_deploy 'umask 077 && cat > /opt/jvb/infra/compose/.env && chmod 600 /opt/jvb/infra/compose/.env' \
    < "$STATE_DIR/compose.env.rendered"
  rm -f "$STATE_DIR/compose.env.rendered"

  info "rendering Caddyfile (api.$DOMAIN + db-admin.$DOMAIN) and installing it"
  ensure_server_helpers
  # Hash the dashboard password ON the server (caddy lives there); the
  # password travels via stdin, never on a local command line.
  local hash
  hash="$(get_secret STUDIO_DASH_PASSWORD | ssh_deploy 'IFS= read -r p; caddy hash-password --plaintext "$p"')" \
    || die "caddy hash-password failed on the server"
  [[ "$hash" == \$2* ]] || die "caddy hash-password did not return a bcrypt hash"

  local content
  content="$(< "$REPO_ROOT/infra/compose/Caddyfile")"
  content="${content//api.example.com/api.$DOMAIN}"
  # Repo Caddyfile names the dashboard vhost studio.example.com; BUILD_PLAN §2
  # (and this bootstrap) use db-admin.<domain> for the break-glass dashboard.
  content="${content//studio.example.com/db-admin.$DOMAIN}"
  content="${content//CHANGE_ME_bcrypt_hash_from_caddy_hash-password/$hash}"
  printf '%s\n' "$content" | ssh_deploy 'cat > /home/deploy/Caddyfile.rendered'
  if ssh_deploy 'sudo -n /usr/local/bin/jvb-install-caddyfile'; then
    info "Caddyfile installed and caddy reloaded"
  else
    warn "Caddyfile install failed — run as root on the server:"
    warn "  caddy validate --config /home/deploy/Caddyfile.rendered --adapter caddyfile"
    warn "  install -m 644 /home/deploy/Caddyfile.rendered /etc/caddy/Caddyfile && systemctl reload caddy"
  fi
}

# ===========================================================================
# step_stack_up — docker compose up -d --build, wait until healthy.
# ===========================================================================
step_stack_up() {
  info "building + starting the compose stack (first run builds image-worker)…"
  ssh_deploy 'cd /opt/jvb/infra/compose && docker compose up -d --build'

  info "waiting for all services to be running/healthy (up to 10 min)…"
  local deadline=$(( SECONDS + 600 )) out bad
  while :; do
    out="$(ssh_deploy 'cd /opt/jvb/infra/compose && docker compose ps -a --format json' 2>/dev/null || true)"
    if [[ -n "$out" ]]; then
      # compose >=2.21 emits one JSON object per line; older emits an array.
      bad="$(jq -r 'if type == "array" then .[] else . end
                    | select((.State != "running")
                             or ((.Health // "") as $h | ($h != "" and $h != "healthy")))
                    | .Service // .Name' <<<"$out" 2>/dev/null || printf 'parse-error')"
      if [[ -z "$bad" ]]; then
        info "all services running/healthy"
        return 0
      fi
    else
      bad="(no ps output yet)"
    fi
    if [[ "$SECONDS" -ge "$deadline" ]]; then
      warn "services not healthy after 10 min: $(tr '\n' ' ' <<<"$bad")"
      local svc
      while IFS= read -r svc; do
        [[ -n "$svc" && "$svc" != "(no ps output yet)" && "$svc" != "parse-error" ]] || continue
        warn "---- last 50 log lines: $svc ----"
        ssh_deploy "cd /opt/jvb/infra/compose && docker compose logs --tail 50 $svc" || true
      done <<<"$bad"
      die "stack did not become healthy"
    fi
    sleep 10
  done
}

# ===========================================================================
# step_migrate — apply supabase/migrations/*.sql in order; track applied
# files in public._bootstrap_migrations so re-runs skip them.
# ===========================================================================
step_migrate() {
  printf 'create table if not exists public._bootstrap_migrations (filename text primary key, applied_at timestamptz not null default now());\n' \
    | remote_psql > /dev/null
  local applied
  applied="$(printf 'select filename from public._bootstrap_migrations;\n' | remote_psql)"

  local f base count=0
  for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
    [[ -e "$f" ]] || die "no migrations found under supabase/migrations/"
    base="$(basename -- "$f")"
    if grep -qxF -- "$base" <<<"$applied"; then
      info "already applied: $base"
      continue
    fi
    info "applying: $base"
    remote_psql < "$f" > /dev/null
    printf "insert into public._bootstrap_migrations (filename) values ('%s') on conflict do nothing;\n" "$base" \
      | remote_psql > /dev/null
    count=$(( count + 1 ))
  done
  # PostgREST caches the schema at startup; after new tables it must be told
  # to reload or it 404s inserts (GET still works off the stale cache).
  printf "notify pgrst, 'reload schema';\n" | remote_psql > /dev/null 2>&1 || true
  info "migrations complete ($count newly applied); PostgREST schema cache reloaded"
}

# ===========================================================================
# step_admin_user — create the first studio admin via the GoTrue admin API,
# then grant the 'admin' role in public.user_roles.
# ===========================================================================
step_admin_user() {
  local srk pw body uid
  srk="$(get_secret SERVICE_ROLE_KEY)"
  pw="$(get_secret ADMIN_PASSWORD)"
  body="$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$pw" '{email: $e, password: $p, email_confirm: true}')"
  _api POST "https://api.$DOMAIN/auth/v1/admin/users" "$body" \
       "Authorization: Bearer $srk" "apikey: $srk"
  if ok; then
    uid="$(jqr '.id // .user.id // empty')"
    info "created auth user $ADMIN_EMAIL"
  else
    if [[ "$API_CODE" != "422" ]]; then
      warn "GoTrue create-user returned HTTP $API_CODE — checking whether the user already exists"
    fi
    _api GET "https://api.$DOMAIN/auth/v1/admin/users?page=1&per_page=1000" "" \
         "Authorization: Bearer $srk" "apikey: $srk"
    ok || die "GoTrue admin API unreachable (HTTP $API_CODE): $API_BODY"
    uid="$(jq -r --arg e "$ADMIN_EMAIL" '[.users[] | select(.email == $e)][0].id // empty' <<<"$API_BODY")"
    [[ -n "$uid" ]] && info "auth user $ADMIN_EMAIL already exists"
  fi
  [[ "$uid" =~ ^[0-9a-fA-F-]{36}$ ]] || die "could not determine a user id for $ADMIN_EMAIL (HTTP $API_CODE): $API_BODY"

  printf "insert into public.user_roles (user_id, role) values ('%s', 'admin') on conflict do nothing;\n" "$uid" \
    | remote_psql > /dev/null
  info "admin role granted to $ADMIN_EMAIL (password stored as ADMIN_PASSWORD in $SECRETS_FILE)"
}

# ===========================================================================
# step_sanity — project 'JVB Gallery', dataset production, robot token.
# Runs BEFORE step_vercel so the Vercel env vars can include the results.
# ===========================================================================
step_sanity() {
  if [[ -z "$SANITY_AUTH_TOKEN" ]]; then
    warn "SANITY_AUTH_TOKEN not set — SKIPPING Sanity. Manually: create project '$SANITY_PROJECT_NAME', dataset '$SANITY_DATASET', an editor robot token 'jvb-sync', then re-run '--only sanity' and '--only vercel'."
    return 0
  fi

  local pid
  sanity_api GET "/projects"
  ok || die "Sanity GET /projects failed (HTTP $API_CODE): $API_BODY"
  pid="$(jq -r --arg n "$SANITY_PROJECT_NAME" '[.[] | select(.displayName == $n)][0].id // empty' <<<"$API_BODY")"
  if [[ -n "$pid" ]]; then
    info "re-using Sanity project '$SANITY_PROJECT_NAME' ($pid)"
  else
    sanity_api POST "/projects" "$(jq -n --arg n "$SANITY_PROJECT_NAME" '{displayName: $n}')"
    ok || die "Sanity POST /projects failed (HTTP $API_CODE): $API_BODY"
    pid="$(jqr '.id // .projectId // empty')"
    [[ -n "$pid" ]] || die "Sanity project created but no id in response: $API_BODY"
    info "created Sanity project '$SANITY_PROJECT_NAME' ($pid)"
  fi
  set_state SANITY_PROJECT_ID "$pid"

  sanity_api PUT "/projects/$pid/datasets/$SANITY_DATASET" ""
  if ok; then
    info "dataset '$SANITY_DATASET' ensured"
  elif grep -qi 'exist' <<<"$API_BODY"; then
    info "dataset '$SANITY_DATASET' already exists"
  else
    warn "could not ensure dataset '$SANITY_DATASET' (HTTP $API_CODE): $API_BODY"
  fi

  if secret_exists SANITY_API_WRITE_TOKEN; then
    info "SANITY_API_WRITE_TOKEN already in secrets.env — keeping it (token values cannot be re-read from Sanity)"
  else
    sanity_api POST "/projects/$pid/tokens" '{"label":"jvb-sync","roleName":"editor"}'
    if ok; then
      local key
      key="$(jqr '.key // empty')"
      [[ -n "$key" ]] || die "Sanity token created but no key in response"
      upsert_secret SANITY_API_WRITE_TOKEN "$key"
      info "created robot token 'jvb-sync' -> stored as SANITY_API_WRITE_TOKEN in secrets.env"
    else
      warn "could not create token 'jvb-sync' (HTTP $API_CODE): $API_BODY"
      warn "if it already exists its value CANNOT be re-read — delete it at sanity.io/manage and re-run '--only sanity', or paste the value into $SECRETS_FILE as SANITY_API_WRITE_TOKEN='…'"
    fi
  fi
}

# ===========================================================================
# step_vercel — projects jvb-studio + jvb-web, env vars, domains, deploys.
# ===========================================================================
ensure_vercel_project() { # name root_dir -> echoes project id
  local name="$1" root="$2" pid
  vercel_api GET "/v9/projects/$name"
  if ok; then
    pid="$(jqr '.id')"
    info "re-using Vercel project $name ($pid)" >&2
  else
    local body
    body="$(jq -n --arg n "$name" --arg r "$root" --arg repo "$GITHUB_REPO" \
      '{name: $n, framework: "nextjs", rootDirectory: $r,
        gitRepository: {type: "github", repo: $repo}}')"
    vercel_api POST "/v11/projects" "$body"
    if ! ok; then
      warn "Vercel project create with git link failed (HTTP $API_CODE): $(jq -r '.error.message // .' <<<"$API_BODY" 2>/dev/null | head -c 300)" >&2
      warn "if the GitHub app is not installed, install it via https://vercel.com/integrations (or the URL in the error above), then re-run '--only vercel'" >&2
      warn "creating $name WITHOUT the git link so env vars + domains can still be configured" >&2
      body="$(jq -n --arg n "$name" --arg r "$root" '{name: $n, framework: "nextjs", rootDirectory: $r}')"
      vercel_api POST "/v11/projects" "$body"
      ok || { warn "Vercel POST /v11/projects for $name failed (HTTP $API_CODE): $API_BODY" >&2; return 1; }
    fi
    pid="$(jqr '.id')"
    info "created Vercel project $name ($pid)" >&2
  fi
  printf '%s' "$pid"
}

vercel_env_upsert() { # project_id project_name key value
  local pid="$1" pname="$2" key="$3" val="$4"
  if [[ -z "$val" ]]; then
    warn "skipping env $key on $pname (no value available)"
    return 0
  fi
  local body
  body="$(jq -n --arg k "$key" --arg v "$val" \
    '[{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}]')"
  vercel_api POST "/v10/projects/$pid/env?upsert=true" "$body"
  if ok; then info "env $key set on $pname"
  else warn "env $key on $pname failed (HTTP $API_CODE): $(head -c 200 <<<"$API_BODY")"; fi
}

add_vercel_domain() { # project_id project_name domain
  vercel_api POST "/v10/projects/$1/domains" "$(jq -n --arg d "$3" '{name: $d}')"
  if ok; then
    info "domain $3 -> $2"
  elif grep -qiE 'already|in_use|conflict' <<<"$API_BODY"; then
    info "domain $3 already attached"
  else
    warn "attaching $3 to $2 failed (HTTP $API_CODE): $(head -c 200 <<<"$API_BODY")"
  fi
}

trigger_vercel_deploy() { # project_name
  local org="${GITHUB_REPO%%/*}" rep="${GITHUB_REPO#*/}" body
  body="$(jq -n --arg n "$1" --arg org "$org" --arg rep "$rep" --arg ref "$GIT_BRANCH" \
    '{name: $n, project: $n, target: "production",
      gitSource: {type: "github", org: $org, repo: $rep, ref: $ref}}')"
  vercel_api POST "/v13/deployments" "$body"
  if ok; then info "deployment triggered for $1 (branch $GIT_BRANCH)"
  else warn "could not trigger a deployment for $1 (HTTP $API_CODE) — pushing to $GIT_BRANCH will deploy anyway"; fi
}

step_vercel() {
  local anon srk sanity_pid
  anon="$(get_secret ANON_KEY)"
  srk="$(get_secret SERVICE_ROLE_KEY)"
  sanity_pid="$(get_state SANITY_PROJECT_ID || true)"
  local sanity_token=""
  if secret_exists SANITY_API_WRITE_TOKEN; then sanity_token="$(get_secret SANITY_API_WRITE_TOKEN)"; fi

  local sid wid
  sid="$(ensure_vercel_project "$VERCEL_PROJECT_STUDIO" "apps/studio")" || sid=""
  wid="$(ensure_vercel_project "$VERCEL_PROJECT_WEB" "apps/web")" || wid=""

  if [[ -n "$sid" ]]; then
    set_state VERCEL_PROJECT_ID_STUDIO "$sid"
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" NEXT_PUBLIC_SUPABASE_URL "https://api.$DOMAIN"
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" NEXT_PUBLIC_SUPABASE_ANON_KEY "$anon"
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" SUPABASE_SERVICE_ROLE_KEY "$srk"
    if [[ -n "$RESEND_API_KEY" ]]; then
      vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" RESEND_API_KEY "$RESEND_API_KEY"
    else
      warn "RESEND_API_KEY not set — skipping it on $VERCEL_PROJECT_STUDIO"
    fi
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" EMAIL_FROM "gallery@$DOMAIN"
    if [[ -n "$sanity_pid" ]]; then
      vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" SANITY_PROJECT_ID "$sanity_pid"
      vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" SANITY_DATASET "$SANITY_DATASET"
      vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" SANITY_API_WRITE_TOKEN "$sanity_token"
    else
      warn "Sanity step did not run — SANITY_PROJECT_ID / SANITY_DATASET / SANITY_API_WRITE_TOKEN not set on $VERCEL_PROJECT_STUDIO (re-run '--only sanity' then '--only vercel')"
    fi
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" SYNC_SHARED_SECRET "$(get_secret SYNC_SHARED_SECRET)"
    vercel_env_upsert "$sid" "$VERCEL_PROJECT_STUDIO" CRON_SECRET "$(get_secret CRON_SECRET)"
    add_vercel_domain "$sid" "$VERCEL_PROJECT_STUDIO" "admin.$DOMAIN"
  fi

  if [[ -n "$wid" ]]; then
    set_state VERCEL_PROJECT_ID_WEB "$wid"
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" NEXT_PUBLIC_SITE_URL "https://$DOMAIN"
    if [[ -n "$sanity_pid" ]]; then
      vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" NEXT_PUBLIC_SANITY_PROJECT_ID "$sanity_pid"
      vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" NEXT_PUBLIC_SANITY_DATASET "$SANITY_DATASET"
    else
      warn "Sanity step did not run — NEXT_PUBLIC_SANITY_* not set on $VERCEL_PROJECT_WEB"
    fi
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" SANITY_REVALIDATE_SECRET "$(get_secret SANITY_REVALIDATE_SECRET)"
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" NEXT_PUBLIC_SUPABASE_URL "https://api.$DOMAIN"
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" NEXT_PUBLIC_SUPABASE_ANON_KEY "$anon"
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" SUPABASE_SERVICE_ROLE_KEY "$srk"
    if [[ -n "$RESEND_API_KEY" ]]; then
      vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" RESEND_API_KEY "$RESEND_API_KEY"
    else
      warn "RESEND_API_KEY not set — skipping it on $VERCEL_PROJECT_WEB"
    fi
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" BOOKING_FROM_EMAIL "bookings@$DOMAIN"
    vercel_env_upsert "$wid" "$VERCEL_PROJECT_WEB" GALLERY_NOTIFICATIONS_EMAIL "$ADMIN_EMAIL"
    add_vercel_domain "$wid" "$VERCEL_PROJECT_WEB" "$DOMAIN"
    add_vercel_domain "$wid" "$VERCEL_PROJECT_WEB" "www.$DOMAIN"
  fi

  # DNS for the Vercel-hosted names.
  local zone
  zone="$(get_state DNS_ZONE || true)"
  if [[ -n "$zone" ]]; then
    upsert_vultr_record "$zone" "$(rel_name "admin.$DOMAIN" "$zone")" CNAME "cname.vercel-dns.com"
    upsert_vultr_record "$zone" "$(rel_name "www.$DOMAIN" "$zone")" CNAME "cname.vercel-dns.com"
    if [[ "$DOMAIN" == "$zone" ]]; then
      upsert_vultr_record "$zone" "" A "76.76.21.21"
    else
      upsert_vultr_record "$zone" "$(rel_name "$DOMAIN" "$zone")" CNAME "cname.vercel-dns.com"
    fi
  else
    warn "DNS zone not managed on Vultr — create these records manually:"
    warn "  admin.$DOMAIN   CNAME  cname.vercel-dns.com"
    warn "  www.$DOMAIN     CNAME  cname.vercel-dns.com"
    if [[ "$DOMAIN" == *.*.* ]]; then
      warn "  $DOMAIN         CNAME  cname.vercel-dns.com   (subdomain)"
    else
      warn "  $DOMAIN         A      76.76.21.21            (apex)"
    fi
  fi

  [[ -z "$sid" ]] || trigger_vercel_deploy "$VERCEL_PROJECT_STUDIO"
  [[ -z "$wid" ]] || trigger_vercel_deploy "$VERCEL_PROJECT_WEB"
}

# ===========================================================================
# step_resend — sending domain + DNS records + verification.
# ===========================================================================
step_resend() {
  if [[ -z "$RESEND_API_KEY" ]]; then
    warn "RESEND_API_KEY not set — SKIPPING Resend. Manually: add + verify domain $DOMAIN at resend.com, then set SMTP_PASS in /opt/jvb/infra/compose/.env and RESEND_API_KEY on both Vercel projects."
    return 0
  fi

  local did
  resend_api GET "/domains"
  ok || die "Resend GET /domains failed (HTTP $API_CODE): $API_BODY"
  did="$(jq -r --arg d "$DOMAIN" '[.data[] | select(.name == $d)][0].id // empty' <<<"$API_BODY")"
  if [[ -n "$did" ]]; then
    info "re-using Resend domain $DOMAIN ($did)"
  else
    resend_api POST "/domains" "$(jq -n --arg d "$DOMAIN" '{name: $d, region: "eu-west-1"}')"
    ok || die "Resend POST /domains failed (HTTP $API_CODE): $API_BODY"
    did="$(jqr '.id')"
    info "created Resend domain $DOMAIN ($did) in eu-west-1"
  fi
  set_state RESEND_DOMAIN_ID "$did"

  resend_api GET "/domains/$did"
  ok || die "Resend GET /domains/$did failed (HTTP $API_CODE): $API_BODY"
  local records zone
  records="$(jqr '.records // []')"
  zone="$(get_state DNS_ZONE || true)"

  info "Resend DNS records (SPF/DKIM/MX):"
  jq -r '.[] | "  \(.record)\t\(.type)\t\(.name)\t\(.value)\(if .priority then " (prio \(.priority))" else "" end)"' <<<"$records"

  if [[ -n "$zone" ]]; then
    local n t v p fq rel
    while IFS=$'\t' read -r n t v p; do
      [[ -n "$n" && -n "$t" ]] || continue
      # Resend names may be relative to $DOMAIN or fully qualified.
      if [[ "$n" == "$DOMAIN" || "$n" == *".$DOMAIN" ]]; then fq="$n"; else fq="$n.$DOMAIN"; fi
      rel="$(rel_name "$fq" "$zone")"
      # Vultr's DNS API expects TXT record data wrapped in double quotes.
      if [[ "$t" == "TXT" && "$v" != \"* ]]; then v="\"$v\""; fi
      if [[ "$t" == "MX" ]]; then
        upsert_vultr_record "$zone" "$rel" "$t" "$v" "${p:-10}"
      else
        upsert_vultr_record "$zone" "$rel" "$t" "$v"
      fi
    done < <(jq -r '.[] | [.name, .type, .value, (.priority // "")] | @tsv' <<<"$records")
  else
    warn "DNS zone not on Vultr — create the records above manually before verification can pass"
  fi

  resend_api POST "/domains/$did/verify" ""
  ok || warn "Resend verify request returned HTTP $API_CODE: $API_BODY"
  resend_api GET "/domains/$did"
  info "Resend domain status: $(jqr '.status // "unknown"') (DNS propagation can take a while — re-run '--only resend' to re-check)"
}

# ===========================================================================
# step_smoke — end-to-end checks.
# ===========================================================================
step_smoke() {
  local anon failures=0
  anon="$(get_secret ANON_KEY)"

  _api GET "https://api.$DOMAIN/auth/v1/health" ""
  if [[ "$API_CODE" == "200" ]]; then info "OK   https://api.$DOMAIN/auth/v1/health (200)"
  else warn "FAIL https://api.$DOMAIN/auth/v1/health (HTTP $API_CODE)"; failures=$(( failures + 1 )); fi

  _api GET "https://api.$DOMAIN/rest/v1/" "" "apikey: $anon" "Authorization: Bearer $anon"
  if [[ "$API_CODE" == "200" ]]; then info "OK   https://api.$DOMAIN/rest/v1/ (200 with anon key)"
  else warn "FAIL https://api.$DOMAIN/rest/v1/ (HTTP $API_CODE)"; failures=$(( failures + 1 )); fi

  local count
  if count="$(printf 'select count(*) from public.pieces;\n' | remote_psql)"; then
    info "OK   db reachable — public.pieces has $count row(s)"
  else
    warn "FAIL could not query public.pieces over SSH"
    failures=$(( failures + 1 ))
  fi

  local url code
  for url in "https://$DOMAIN" "https://admin.$DOMAIN"; do
    code="$(curl -sI --max-time 20 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || printf '000')"
    if [[ "$code" == "000" ]]; then
      warn "info $url not reachable yet (DNS/deploy may still be propagating)"
    else
      info "info $url responded HTTP $code"
    fi
  done

  [[ "$failures" -eq 0 ]] || warn "$failures smoke check(s) failed — investigate before go-live"
}

# ===========================================================================
# step_summary
# ===========================================================================
step_summary() {
  local ip zone sanity_pid
  ip="$(get_state INSTANCE_IP || printf 'unknown')"
  zone="$(get_state DNS_ZONE || true)"
  sanity_pid="$(get_state SANITY_PROJECT_ID || printf '(sanity step skipped)')"
  cat <<EOF

+============================================================================+
|                          BOOTSTRAP SUMMARY                                 |
+============================================================================+
| URLs                                                                       |
|   Public site       https://$DOMAIN  (+ https://www.$DOMAIN)
|   Studio app        https://admin.$DOMAIN
|   Supabase API      https://api.$DOMAIN
|   Supabase dash     https://db-admin.$DOMAIN  (basic-auth, break-glass)
|   VPS               deploy@$ip  port $SSH_PORT  (key: $SSH_KEY_FILE)
|   Sanity project    $sanity_pid  (dataset: $SANITY_DATASET)
+----------------------------------------------------------------------------
| Secrets — values are NEVER printed. They live in exactly two places:
|   1. $SECRETS_FILE  (chmod 600 — copy into your password manager, see DR §8)
|   2. server: /opt/jvb/infra/compose/.env (chmod 600, deploy-owned)
|   Studio admin login: $ADMIN_EMAIL  (password = ADMIN_PASSWORD in secrets.env)
|   Supabase dashboard: user 'admin' (password = STUDIO_DASH_PASSWORD)
+----------------------------------------------------------------------------
| Manual items that remain:
|   - DNS: if the zone is not on Vultr DNS ($([[ -n "$zone" ]] && printf 'it IS: %s' "$zone" || printf 'it is NOT')),
|     create/verify the records printed by step_dns / step_vercel / step_resend.
|   - Vercel: if the GitHub app install was missing, link $GITHUB_REPO to the
|     projects at vercel.com and redeploy (or push to $GIT_BRANCH).
|   - Sanity: deploy the Studio schema from apps/web/sanity when ready.
|   - Resend: wait for domain verification (re-run '--only resend' to check).
|   - Backups: install the backup.sh cron jobs + healthchecks.io pings and run
|     restore-drill.sh once the first nightly dump exists (infra/README.md §5).
|   - SECURITY: rotate every operator token pasted into this shell
|     (VULTR_API_KEY, VERCEL_TOKEN, SANITY_AUTH_TOKEN, RESEND_API_KEY) after
|     go-live, and keep $STATE_DIR out of git forever.
+============================================================================+
EOF
}

# ===========================================================================
# Main
# ===========================================================================
main() {
  preflight_env
  preflight_deps
  init_state_dir

  info "state dir: $STATE_DIR"
  info "step order: ${STEPS[*]}"
  [[ -n "$ONLY_STEP" ]] && info "running ONLY step_$ONLY_STEP"
  [[ -n "$FROM_STEP" ]] && info "starting FROM step_$FROM_STEP"

  if [[ "$YES" -ne 1 ]]; then
    printf '\nThis will create PAID resources on Vultr (~$48/mo VPS + ~$18/mo object storage),\nplus Vercel projects, a Sanity project and a Resend domain for %s.\n' "$DOMAIN"
    printf 'Re-runs re-use existing resources (idempotent). Continue? [y/N] '
    local reply
    read -r reply
    [[ "$reply" == y || "$reply" == Y || "$reply" == yes ]] || die "aborted by operator (use --yes to skip this prompt)"
  fi

  local s started=1
  [[ -z "$FROM_STEP" ]] || started=0
  for s in "${STEPS[@]}"; do
    if [[ -n "$ONLY_STEP" && "$s" != "$ONLY_STEP" ]]; then continue; fi
    [[ "$s" == "$FROM_STEP" ]] && started=1
    [[ "$started" -eq 1 ]] || continue
    info "================ step_$s ================"
    "step_$s"
  done
  info "bootstrap finished"
}

# Run only when executed, not when sourced (sourcing is handy for testing).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main
fi

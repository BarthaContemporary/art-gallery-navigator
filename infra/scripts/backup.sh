#!/usr/bin/env bash
# ===========================================================================
# backup.sh — nightly Postgres dump + weekly storage-bucket replication
# (BUILD_PLAN §2: 30 daily / 12 monthly, healthchecks ping, rclone sync).
#
# Modes:
#   backup.sh db             pg_dump -Fc → rclone → prune → healthchecks ping
#   backup.sh storage-sync   rclone sync of the storage bucket to its replica
#   backup.sh webdav-sync    rclone sync of the WebDAV shared drive to backup
#                            (syncs the gocryptfs CIPHERTEXT dir, so the backup
#                             is encrypted at rest by construction)
#
# Requirements on the VPS:
#   * rclone configured with a remote named "$RCLONE_REMOTE" pointing at
#     Vultr Object Storage, e.g. ~/.config/rclone/rclone.conf:
#         [vultr]
#         type = s3
#         provider = Other
#         endpoint = https://lhr1.vultrobjects.com
#         access_key_id = ...
#         secret_access_key = ...
#   * the compose stack running (db dump goes through `docker compose exec`)
#
# Cron (crontab -e as the deploy user; MAILTO optional):
#   # nightly DB backup at 02:30 UTC
#   30 2 * * *  /opt/jvb/infra/scripts/backup.sh db           >> /var/log/jvb-backup.log 2>&1
#   # weekly storage replica, Sundays 03:30 UTC
#   30 3 * * 0  /opt/jvb/infra/scripts/backup.sh storage-sync >> /var/log/jvb-backup.log 2>&1
#   # nightly WebDAV shared-drive backup at 03:00 UTC
#   0  3 * * *  /opt/jvb/infra/scripts/backup.sh webdav-sync  >> /var/log/jvb-backup.log 2>&1
# ===========================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Config (override via environment or edit here).
# ---------------------------------------------------------------------------
# Stable, root-only overrides that survive a tar-ship redeploy of this script:
# put HEALTHCHECKS_* ping URLs (and any other overrides) in /etc/jvb/backup.env.
# shellcheck disable=SC1091
[[ -f /etc/jvb/backup.env ]] && . /etc/jvb/backup.env

COMPOSE_DIR="${COMPOSE_DIR:-/opt/jvb/infra/compose}"
RCLONE_REMOTE="${RCLONE_REMOTE:-vultr}"
BACKUP_BUCKET="${BACKUP_BUCKET:-jvb-backups}"
BACKUP_PREFIX="backups/postgres"
DEST="$RCLONE_REMOTE:$BACKUP_BUCKET/$BACKUP_PREFIX"

STORAGE_BUCKET="${STORAGE_BUCKET:-jvb-storage}"
STORAGE_REPLICA_BUCKET="${STORAGE_REPLICA_BUCKET:-jvb-storage-replica}"

# WebDAV shared drive: back up the gocryptfs CIPHERTEXT store (already
# encrypted at rest), so no extra crypto is needed on the backup path.
WEBDAV_CIPHER_DIR="${WEBDAV_CIPHER_DIR:-/opt/jvb/webdav-cipher}"
WEBDAV_BACKUP_PREFIX="backups/webdav"
HEALTHCHECKS_WEBDAV_URL="${HEALTHCHECKS_WEBDAV_URL:-}"

KEEP_DAILY=30      # newest N dumps always kept
KEEP_MONTHS=12     # plus the first dump of each of the last N months

# healthchecks.io ping URLs — empty string disables the ping.
HEALTHCHECKS_URL="${HEALTHCHECKS_URL:-}"                  # for `db`
HEALTHCHECKS_STORAGE_URL="${HEALTHCHECKS_STORAGE_URL:-}"  # for `storage-sync`

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

ping_healthchecks() {
  local url="$1"
  if [[ -n "$url" ]]; then
    curl -fsS -m 10 --retry 3 -o /dev/null "$url" \
      && log "healthchecks ping ok" \
      || log "WARNING: healthchecks ping failed (backup itself succeeded)"
  fi
}

# Record a successful run in the DB so the studio dashboard can show backup
# health. Best-effort: a DB hiccup must never fail the backup. kind is a fixed
# literal; detail/size are locally generated (filenames/ints), so the values
# are trusted — but keep detail to safe characters.
record_run() {
  local kind="$1" size="${2:-}"
  local detail="${3:-}"
  detail="${detail//\'/}"   # strip quotes defensively
  local sizeval="null"
  [[ -n "$size" ]] && sizeval="$size"
  local detailval="null"
  [[ -n "$detail" ]] && detailval="'$detail'"
  docker compose --project-directory "$COMPOSE_DIR" exec -T db \
    psql -U postgres -d postgres -q -c \
    "insert into backup_runs (kind, status, size_bytes, detail) values ('$kind','ok',$sizeval,$detailval);" \
    >/dev/null 2>&1 \
    && log "recorded $kind run in db" \
    || log "WARNING: could not record $kind run in db (backup itself succeeded)"
}

# ---------------------------------------------------------------------------
# db: dump, upload, prune, ping
# ---------------------------------------------------------------------------
backup_db() {
  local ts file tmp
  ts="$(date -u +%Y-%m-%dT%H%M%SZ)"
  file="jvb-postgres-$ts.dump"          # sortable name → prune logic below
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  log "dumping postgres (custom format) → $file"
  # -T: no TTY (cron); custom format (-Fc) is compressed and pg_restore-able.
  docker compose --project-directory "$COMPOSE_DIR" exec -T db \
    pg_dump -U postgres -d postgres -Fc > "$tmp/$file"
  local bytes
  bytes="$(stat -c%s "$tmp/$file" 2>/dev/null || echo "")"
  log "dump size: $(du -h "$tmp/$file" | cut -f1)"

  log "uploading to $DEST/$file"
  rclone copyto "$tmp/$file" "$DEST/$file"

  prune_db_backups
  record_run db "$bytes" "$file"
  ping_healthchecks "$HEALTHCHECKS_URL"
  log "db backup complete"
}

# ---------------------------------------------------------------------------
# Prune: keep the newest $KEEP_DAILY dumps, plus the FIRST dump of each of
# the last $KEEP_MONTHS months; delete everything else. Filenames embed a
# UTC timestamp so lexicographic sort == chronological sort.
# ---------------------------------------------------------------------------
prune_db_backups() {
  local all=()
  mapfile -t all < <(rclone lsf "$DEST" --files-only | grep '^jvb-postgres-' | sort)
  (( ${#all[@]} )) || { log "prune: nothing to prune"; return; }

  declare -A keep=()

  # 1. newest N dailies
  local f
  while IFS= read -r f; do
    keep["$f"]=1
  done < <(printf '%s\n' "${all[@]}" | tail -n "$KEEP_DAILY")

  # 2. first dump of each of the last N months
  local i month first
  for i in $(seq 0 $((KEEP_MONTHS - 1))); do
    month="$(date -u -d "-$i month" +%Y-%m)"
    first="$(printf '%s\n' "${all[@]}" | grep "^jvb-postgres-$month" | head -n 1 || true)"
    [[ -n "$first" ]] && keep["$first"]=1
  done

  # 3. delete the rest
  local deleted=0
  for f in "${all[@]}"; do
    if [[ -z "${keep[$f]:-}" ]]; then
      log "prune: deleting $f"
      rclone deletefile "$DEST/$f"
      deleted=$((deleted + 1))
    fi
  done
  log "prune: kept ${#keep[@]}, deleted $deleted (of ${#all[@]})"
}

# ---------------------------------------------------------------------------
# storage-sync: replicate the storage bucket to a second bucket. Guards
# against losing objects to accidental deletion/bucket compromise; it is NOT
# versioned, so run restore drills on the DB path, not this one.
# ---------------------------------------------------------------------------
backup_storage() {
  log "syncing $STORAGE_BUCKET → $STORAGE_REPLICA_BUCKET"
  rclone sync \
    "$RCLONE_REMOTE:$STORAGE_BUCKET" \
    "$RCLONE_REMOTE:$STORAGE_REPLICA_BUCKET" \
    --fast-list --transfers 8 --stats-one-line --stats 5m
  record_run storage
  ping_healthchecks "$HEALTHCHECKS_STORAGE_URL"
  log "storage sync complete"
}

# ---------------------------------------------------------------------------
# webdav-sync: replicate the WebDAV shared drive to the backup bucket. We sync
# the gocryptfs CIPHERTEXT directory, so what lands in object storage is
# already encrypted — no key ever leaves the VPS. Not versioned; pair with
# object-storage versioning/lifecycle if you want point-in-time recovery.
# ---------------------------------------------------------------------------
backup_webdav() {
  if [[ ! -d "$WEBDAV_CIPHER_DIR" ]]; then
    log "WARNING: WEBDAV_CIPHER_DIR ($WEBDAV_CIPHER_DIR) not found — skipping"
    return 0
  fi
  local dest="$RCLONE_REMOTE:$BACKUP_BUCKET/$WEBDAV_BACKUP_PREFIX"
  log "syncing WebDAV ciphertext $WEBDAV_CIPHER_DIR → $dest"
  rclone sync "$WEBDAV_CIPHER_DIR" "$dest" \
    --fast-list --transfers 8 --stats-one-line --stats 5m
  record_run webdav
  ping_healthchecks "$HEALTHCHECKS_WEBDAV_URL"
  log "webdav sync complete"
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
case "${1:-db}" in
  db)           backup_db ;;
  storage-sync) backup_storage ;;
  webdav-sync)  backup_webdav ;;
  *)
    echo "usage: $0 {db|storage-sync|webdav-sync}" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# ===========================================================================
# restore-drill.sh — quarterly proof that our backups actually restore
# (BUILD_PLAN §2). A backup that has never been restored is a hope, not a
# backup.
#
# What it does:
#   1. downloads the LATEST dump from Object Storage
#   2. spins up a THROWAWAY Postgres container (pgvector image — the schema
#      uses vector() columns) on a random loopback port
#   3. pg_restore's the dump into it
#   4. runs sanity queries (row counts for pieces / piece_images)
#   5. prints a PASS/FAIL report and tears everything down
#
# Run on the VPS (or any machine with docker + the rclone remote):
#   ./restore-drill.sh
#
# Cron (optional — quarterly, 1st of Jan/Apr/Jul/Oct at 04:00 UTC):
#   0 4 1 1,4,7,10 *  /opt/jvb/infra/scripts/restore-drill.sh >> /var/log/jvb-restore-drill.log 2>&1
# ===========================================================================
set -euo pipefail

RCLONE_REMOTE="${RCLONE_REMOTE:-vultr}"
BACKUP_BUCKET="${BACKUP_BUCKET:-jvb-backups}"
BACKUP_PREFIX="backups/postgres"
DEST="$RCLONE_REMOTE:$BACKUP_BUCKET/$BACKUP_PREFIX"

# supabase/postgres dumps reference pgvector types; plain postgres:15 would
# fail on them, so the drill uses the pgvector community image.
DRILL_IMAGE="pgvector/pgvector:pg15"
DRILL_CONTAINER="jvb-restore-drill"
DRILL_PORT="${DRILL_PORT:-55432}"   # loopback only
DRILL_PASSWORD="drill-only-not-secret"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

TMP="$(mktemp -d)"
cleanup() {
  log "cleaning up (container + temp files)"
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Locate + download the latest dump.
# ---------------------------------------------------------------------------
LATEST="$(rclone lsf "$DEST" --files-only | grep '^jvb-postgres-' | sort | tail -n 1)"
if [[ -z "$LATEST" ]]; then
  log "FAIL: no dumps found at $DEST"
  exit 1
fi
log "latest dump: $LATEST"
rclone copyto "$DEST/$LATEST" "$TMP/latest.dump"
log "downloaded $(du -h "$TMP/latest.dump" | cut -f1)"

# ---------------------------------------------------------------------------
# 2. Throwaway Postgres.
# ---------------------------------------------------------------------------
docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$DRILL_CONTAINER" \
  -e POSTGRES_PASSWORD="$DRILL_PASSWORD" \
  -p "127.0.0.1:$DRILL_PORT:5432" \
  "$DRILL_IMAGE" >/dev/null
log "started $DRILL_IMAGE as $DRILL_CONTAINER on 127.0.0.1:$DRILL_PORT"

log "waiting for postgres to accept connections"
for i in $(seq 1 30); do
  if docker exec "$DRILL_CONTAINER" pg_isready -U postgres -q; then break; fi
  [[ "$i" == 30 ]] && { log "FAIL: postgres did not come up"; exit 1; }
  sleep 1
done

# ---------------------------------------------------------------------------
# 3. Restore. The dump comes from a Supabase cluster, so first create the
# roles it references; --no-owner/--no-privileges keep the drill about DATA
# integrity, not about reproducing the full supabase role setup.
# ---------------------------------------------------------------------------
docker exec "$DRILL_CONTAINER" psql -U postgres -q -c "
  DO \$\$ BEGIN
    CREATE ROLE anon NOLOGIN;                EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
  DO \$\$ BEGIN
    CREATE ROLE authenticated NOLOGIN;       EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
  DO \$\$ BEGIN
    CREATE ROLE service_role NOLOGIN;        EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
  DO \$\$ BEGIN
    CREATE ROLE supabase_admin NOLOGIN;      EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
  DO \$\$ BEGIN
    CREATE ROLE authenticator NOLOGIN;       EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
"

log "restoring dump (this can take a while)"
docker cp "$TMP/latest.dump" "$DRILL_CONTAINER:/tmp/latest.dump"
# Supabase-managed schemas (auth, storage, extensions…) may throw benign
# errors on a vanilla image; log them but judge the drill on the sanity
# queries below.
if docker exec "$DRILL_CONTAINER" \
  pg_restore -U postgres -d postgres --no-owner --no-privileges /tmp/latest.dump \
  > "$TMP/restore.log" 2>&1; then
  log "pg_restore finished without errors"
else
  log "pg_restore finished WITH errors (see below) — verifying data anyway"
  tail -n 20 "$TMP/restore.log" | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# 4. Sanity queries — the tables that matter must exist and hold rows.
# ---------------------------------------------------------------------------
count() {
  docker exec "$DRILL_CONTAINER" psql -U postgres -X -A -t \
    -c "SELECT count(*) FROM public.$1" 2>/dev/null || echo "QUERY_FAILED"
}

PIECES_COUNT="$(count pieces)"
IMAGES_COUNT="$(count piece_images)"

# ---------------------------------------------------------------------------
# 5. Report.
# ---------------------------------------------------------------------------
echo "======================================================================"
echo " RESTORE DRILL REPORT — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "----------------------------------------------------------------------"
echo "  dump:            $LATEST"
echo "  dump size:       $(du -h "$TMP/latest.dump" | cut -f1)"
echo "  pieces:          $PIECES_COUNT"
echo "  piece_images:    $IMAGES_COUNT"
echo "----------------------------------------------------------------------"
if [[ "$PIECES_COUNT" =~ ^[0-9]+$ && "$IMAGES_COUNT" =~ ^[0-9]+$ && "$PIECES_COUNT" -gt 0 ]]; then
  echo "  RESULT: PASS — dump restores and core tables contain data."
  echo "======================================================================"
  exit 0
else
  echo "  RESULT: FAIL — investigate immediately (backups may be unusable)."
  echo "======================================================================"
  exit 1
fi

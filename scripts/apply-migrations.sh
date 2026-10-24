#!/usr/bin/env bash
# Apply database migrations to the live server through the SSH tunnel
# (docs/ops/security-runbook.md step 5.4), in number order, each in a single
# transaction with a lock timeout, stopping at the first error. A migration
# that fails leaves the database exactly as it was before that file.
#
#   scripts/apply-migrations.sh 0089 0096     # every migration from 0089 to 0096
#   scripts/apply-migrations.sh 0091          # just one
#   CHECK=1 scripts/apply-migrations.sh 0089 0096   # list what would run, change nothing
#
# Needs: the tunnel open in another window
#   ssh -N -L 54322:127.0.0.1:5432 root@<server>
# and psql on this computer. It asks for the database password once per file
# unless PGPASSWORD is set (POSTGRES_PASSWORD from the server's .env).
# DATABASE_URL overrides the connection (default: the tunnel, as supabase_admin).
set -euo pipefail
cd "$(dirname "$0")/.."
FROM="${1:?give the first migration number, e.g. 0089}"
TO="${2:-$FROM}"
CONN="${DATABASE_URL:-host=127.0.0.1 port=54322 user=supabase_admin dbname=postgres}"

mapfile -t FILES < <(ls supabase/migrations/0*.sql | sort | while read -r f; do
  n="$(basename "$f" | cut -d_ -f1)"
  if [ "$((10#$n))" -ge "$((10#$FROM))" ] && [ "$((10#$n))" -le "$((10#$TO))" ]; then echo "$f"; fi
done)
[ "${#FILES[@]}" -gt 0 ] || { echo "No migrations numbered $FROM to $TO."; exit 1; }

echo "Migrations to apply, in this order:"
printf '  %s\n' "${FILES[@]}"
[ -n "${CHECK:-}" ] && exit 0

# A lock that cannot be had in 10 seconds fails the file (and leaves it
# unapplied) instead of queueing behind live traffic; no single statement may
# run longer than 5 minutes.
export PGOPTIONS="-c lock_timeout=10s -c statement_timeout=5min"
for f in "${FILES[@]}"; do
  echo "== applying $f"
  if ! psql "$CONN" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f"; then
    echo "!! $f failed and was rolled back; nothing after it was applied."
    echo "   Read the error above, fix the cause, then run this script again from $(basename "$f" | cut -d_ -f1)."
    exit 1
  fi
done
psql "$CONN" -X -q -c "notify pgrst, 'reload schema';"
echo "All applied. The API has reloaded its schema."

#!/usr/bin/env bash
# Build a throwaway local Postgres with every migration applied, in the order
# the live database received them, then run the SQL tests given (or all of
# tests/*.sql). Nothing here touches the live server.
#
#   scripts/db-harness/run.sh                 # migrations + every test
#   scripts/db-harness/run.sh tests/x.sql     # migrations + one test
#   KEEP=1 scripts/db-harness/run.sh          # leave the server running (port 55432)
#
# Needs a local Postgres 16 (initdb/pg_ctl under /usr/lib/postgresql/16/bin).
# Runs the server as the "postgres" system user when started as root.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${PORT:-55432}"
DATA="$(mktemp -d "${TMPDIR:-/tmp}/jvb-db-harness.XXXXXX")"
LOG="$DATA.log"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
chown postgres "$DATA" 2>/dev/null || true
as_pg "$BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
as_pg "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$LOG" -w start >/dev/null
stop() { [ -n "${KEEP:-}" ] && { echo "server left running: psql -h $DATA -p $PORT -U postgres jvb"; return; }; as_pg "$BIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null; rm -rf "$DATA" "$LOG"; }
trap stop EXIT
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$DATA" -p "$PORT" -U postgres)
"${PSQL[@]}" -d postgres -c "create database jvb" >/dev/null
"${PSQL[@]}" -d jvb -f "$HERE/supabase-stubs.sql" >/dev/null

# The live order: the 2026071300000N base series, then 0048 onwards.
mapfile -t FILES < <(cd "$REPO/supabase/migrations" && { ls 2026*.sql | sort; ls 0*.sql | sort; })
n=0
for f in "${FILES[@]}"; do
  # Changes the live database received by hand, with no migration of their
  # own (repository drift), go in hooks/<migration>.pre.sql and run first.
  if [ -f "$HERE/hooks/$f.pre.sql" ]; then
    "${PSQL[@]}" -d jvb -f "$HERE/hooks/$f.pre.sql" >/dev/null
  fi
  # pgvector is not packaged locally: the embedding column becomes a plain
  # real[] here (no policy or grant depends on its type).
  if ! sed -E -e 's/^create extension if not exists vector;/-- (vector skipped locally)/' \
      -e 's/\bvector\(([0-9]+)\)/real[]/g' "$REPO/supabase/migrations/$f" \
      | "${PSQL[@]}" -d jvb >/dev/null 2>"$DATA.err"; then
    echo "MIGRATION FAILED: $f"; cat "$DATA.err"; exit 1
  fi
  n=$((n + 1))
done
echo "migrations: $n applied"

TESTS=("$@")
[ ${#TESTS[@]} -eq 0 ] && mapfile -t TESTS < <(ls "$HERE"/tests/*.sql 2>/dev/null | sort)
fail=0
for t in "${TESTS[@]}"; do
  [ -f "$t" ] || t="$HERE/$t"
  if "${PSQL[@]}" -d jvb -f "$t" >/dev/null 2>"$DATA.err"; then
    echo "ok   $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"; sed 's/^/     /' "$DATA.err"; fail=1
  fi
done
exit $fail

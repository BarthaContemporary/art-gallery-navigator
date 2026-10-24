#!/usr/bin/env bash
# Many simultaneous calls for one key admit exactly the limit (0089's lock).
# Run with the harness server kept up: KEEP=1 scripts/db-harness/run.sh, then
#   scripts/db-harness/concurrency-rate-limit.sh <socket dir printed by run.sh>
set -euo pipefail
SOCK="${1:?socket directory of a KEEP=1 harness}"
PORT="${PORT:-55432}"
q() { psql -X -q -t -A -h "$SOCK" -p "$PORT" -U postgres jvb -c "$1"; }
q "delete from public.rate_limit_hits where key = 'race:test'"
for i in $(seq 1 40); do q "select public.rate_limit_hit('race:test', interval '1 hour', 5)" & done > "${TMPDIR:-/tmp}/race.$$"
wait
allowed=$(grep -c '^t$' "${TMPDIR:-/tmp}/race.$$" || true); rm -f "${TMPDIR:-/tmp}/race.$$"
echo "allowed: $allowed of 40 (limit 5)"
[ "$allowed" -eq 5 ]

#!/usr/bin/env bash
# Checks the search site (search.<host>, the last site in infra/compose/Caddyfile)
# from the outside, for docs/ops/opensearch-runbook.md. Run it after every
# change to that site, and after changing a search password.
#
#   BASE=https://search.104-238-184-145.sslip.io infra/scripts/verify-search-edge.sh
#
# It asks for the two passwords (from the password manager) unless SEARCH_PW
# and INDEX_PW are already set; nothing secret is printed or put on a command
# line. Exit status 0 only when every line says OK.
#
# It only reads. Nothing is created, changed or deleted, even if the site
# were wrong: every request that could write names a jvb-<kind>-v0 index,
# which the studio never uses (its versions start at 1), and carries a body
# the engine refuses or no body at all.
#
# Each line says who answered: "edge" (Caddy itself; the request never
# reached OpenSearch), "login" (Caddy's password check: a 401 with a
# password prompt, the WWW-Authenticate header) or "engine" (OpenSearch
# answered: its replies carry an X-OpenSearch-Version header). Where the
# engine should answer, any answer from it is right: 200, or 404 while an
# index has not been made yet, or 400 for the v0 probes. A name that is not
# one of the two logins, and the search login asking for anything but a
# search, must get "edge 401": refused before Caddy checks any password
# (Caddy checks a name its password list does not hold against a built-in
# hash that costs it almost a second of processor time).
# apps/studio/src/app/login/search-edge-config.test.ts checks every line
# below against the Caddyfile's search block, so keep the `check` lines in
# this exact form.
set -u
BASE=${BASE:?set BASE, for example BASE=https://search.104-238-184-145.sslip.io}
BASE=${BASE%/}
SEARCH_USER=${SEARCH_USER:-jvb-search}
INDEX_USER=${INDEX_USER:-jvb-index}
if [ -z "${SEARCH_PW:-}" ]; then read -rsp "Password for $SEARCH_USER: " SEARCH_PW; echo; fi
if [ -z "${INDEX_PW:-}" ]; then read -rsp "Password for $INDEX_USER: " INDEX_PW; echo; fi

HDR=$(mktemp)
trap 'rm -f "$HDR"' EXIT
fail=0

# Request bodies. Q finds nothing. NO_INDEX asks for an index with no shards,
# which the engine refuses, so even a wrongly allowed PUT makes nothing.
Q='{"query":{"match_none":{}},"size":0}'
NO_INDEX='{"settings":{"index":{"number_of_shards":0}}}'
NO_ALIASES='{"actions":[]}'
EMPTY='{}'

check() { # want label login method target [body]
  local want=$1 label=$2 login=$3 method=$4 target=$5 body=${6-}
  local args=(-s -g --path-as-is -o /dev/null -D "$HDR" -w '%{http_code}' -m 20 -X "$method")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data-binary "$body")
  local auth=''
  case $login in
    none) ;;
    wrong-search) auth="user = \"$SEARCH_USER:not-the-password\"" ;;
    wrong-index) auth="user = \"$INDEX_USER:not-the-password\"" ;;
    unknown) auth="user = \"jvb-nobody:not-the-password\"" ;;
    lookalike) auth="user = \"jvb-index9:not-the-password\"" ;;
    search) auth="user = \"$SEARCH_USER:$SEARCH_PW\"" ;;
    index) auth="user = \"$INDEX_USER:$INDEX_PW\"" ;;
    *) echo "unknown login $login"; exit 2 ;;
  esac
  : > "$HDR"
  local code who
  # The login goes to curl on its standard input (-K -), never as an argument.
  code=$(printf '%s\n' "$auth" | curl -K - "${args[@]}" "$BASE$target") || code=000
  if grep -qi '^x-opensearch-version:' "$HDR"; then who=engine
  elif [ "$code" = 401 ] && grep -qi '^www-authenticate:' "$HDR"; then who=login
  else who=edge; fi
  if [ "$who" = "$want" ] || { [ "$who" = edge ] && [ "$code" = "$want" ]; }; then
    printf 'OK     %-6s %s  %s\n' "$who" "$code" "$label"
  else
    printf 'WRONG  %-6s %s  (want %s)  %s\n' "$who" "$code" "$want" "$label"
    fail=1
  fi
}

echo "-- no password, or a wrong one: the password prompt"
check login "search, no password" none POST '/jvb-works-v1/_search' "$Q"
check login "search, wrong password" wrong-search POST '/jvb-works-v1/_search' "$Q"
check login "search, the index name with a wrong password" wrong-index POST '/jvb-works-v1/_search' "$Q"
check login "health, no password" none GET '/_cluster/health'
check login "health, the index name with a wrong password" wrong-index GET '/_cluster/health'
check login "bulk write, no password" none POST '/jvb-works-v0/_bulk'
check login "bulk write, the index name with a wrong password" wrong-index POST '/jvb-works-v0/_bulk'
check 404 "front page" none GET '/'
check 404 "the old /health path" none GET '/health'
check 404 "every index" none GET '/_cat/indices'
check 400 "encoded comma" none POST '/jvb-works-v1%2C%2A/_search' "$Q"

echo "-- a name that is not one of the two: refused before any password check"
check 401 "search, a made-up name" unknown POST '/jvb-works-v1/_search' "$Q"
check 401 "search, a name that begins like jvb-index" lookalike POST '/jvb-works-v1/_search' "$Q"
check 401 "bulk write, a made-up name" unknown POST '/jvb-works-v0/_bulk'
check 401 "bulk write, a name that begins like jvb-index" lookalike POST '/jvb-works-v0/_bulk'
check 401 "health, a made-up name" unknown GET '/_cluster/health'
check 401 "health, a name that begins like jvb-index" lookalike GET '/_cluster/health'
check 401 "front page, a made-up name" unknown GET '/'
check 400 "encoded comma, a made-up name" unknown POST '/jvb-works-v1%2C%2A/_search' "$Q"

echo "-- the search login: one index per search, POST; anything else refused before any password check"
check engine "search works" search POST '/jvb-works-v1/_search' "$Q"
check engine "search makers" search POST '/jvb-makers-v1/_search' "$Q"
check engine "search contacts" search POST '/jvb-contacts-v1/_search' "$Q"
check 401 "a name without a version" search POST '/jvb-works/_search' "$Q"
check 401 "an index the studio does not have" search POST '/jvb-records-v1/_search' "$Q"
check 401 "two indices in one address" search POST '/jvb-works-v1,jvb-contacts-v1/_search' "$Q"
check 401 "a wildcard" search POST '/jvb-*/_search' "$Q"
check 401 "an index plus everything" search POST '/jvb-works-v1,*/_search' "$Q"
check 401 "_all" search POST '/_all/_search' "$Q"
check 401 "every index at once" search POST '/_search' "$Q"
check 400 "encoded comma" search POST '/jvb-works-v1%2C%2A/_search' "$Q"
check 400 "encoded letter" search POST '/%6Avb-works-v1/_search' "$Q"
check 400 "doubled slash" search POST '//jvb-works-v1/_search' "$Q"
check 400 "dot segments" search POST '/jvb-works-v1/../_all/_search' "$Q"
check 401 "trailing slash" search POST '/jvb-works-v1/_search/' "$Q"
check 401 "query string: q=" search POST '/jvb-contacts-v1/_search?q=email:a*' "$Q"
check 401 "query string: scroll=" search POST '/jvb-works-v1/_search?scroll=1m' "$Q"
check 401 "query string: index=" search POST '/jvb-works-v1/_search?index=jvb-contacts-v1' "$Q"
check 401 "GET search" search GET '/jvb-works-v1/_search'
check 401 "multi-search" search POST '/jvb-works-v1/_msearch' "$Q"
check 401 "multi-get" search POST '/jvb-contacts-v1/_mget' '{"ids":[]}'
check 401 "one document" search GET '/jvb-contacts-v1/_doc/x'
check 401 "point in time" search POST '/jvb-contacts-v0/_search/point_in_time?keep_alive=1m'
check 401 "aliases" search GET '/_aliases'
check 401 "query log" search GET '/_insights/top_queries'
check 401 "node details" search GET '/_nodes'
check 401 "search login, bulk write" search POST '/jvb-works-v0/_bulk'
check 401 "search login, make an index" search PUT '/jvb-works-v0' "$NO_INDEX"
check 401 "search login, delete an index" search DELETE '/jvb-works-v0'
check 401 "search login, refresh" search POST '/jvb-works-v0/_refresh'
check 401 "search login, count" search GET '/jvb-works-v1/_count'
check 401 "search login, mapping" search GET '/jvb-contacts-v1/_mapping'
check 401 "search login, health" search GET '/_cluster/health'
check 401 "search login, list of indices" search GET '/_cat/indices/jvb-*?format=json&h=index,health,docs.count,docs.deleted,store.size'
check 401 "search name with a wrong password, bulk write" wrong-search POST '/jvb-works-v0/_bulk'
check 401 "search name with a wrong password, health" wrong-search GET '/_cluster/health'

echo "-- the index login: what the sync route, reconcile and Admin send"
check engine "search (reconcile lists the ids)" index POST '/jvb-contacts-v1/_search' "$Q"
check engine "health" index GET '/_cluster/health'
check engine "disk-guard blocks" index GET '/_cluster/settings?flat_settings=true'
check engine "list of jvb- indices" index GET '/_cat/indices/jvb-*?format=json&h=index,health,docs.count,docs.deleted,store.size'
check engine "count" index GET '/jvb-works-v1/_count'
check engine "mapping" index GET '/jvb-works-v1/_mapping'
check engine "settings of an index" index GET '/jvb-works-v1/_settings'
check engine "bulk write (v0, no body: refused by the engine)" index POST '/jvb-works-v0/_bulk?refresh=true'
check engine "make an index (v0, no shards: refused by the engine)" index PUT '/jvb-works-v0' "$NO_INDEX"
check engine "delete an index (v0: there is none)" index DELETE '/jvb-works-v0'
check engine "refresh (v0: there is none)" index POST '/jvb-makers-v0/_refresh'
check engine "squeeze out deleted contacts (v0: there is none)" index POST '/jvb-contacts-v0/_forcemerge?only_expunge_deletes=true'
check 404 "health with extra parameters" index GET '/_cluster/health?wait_for_status=green&timeout=60s'
check 404 "health of one index" index GET '/_cluster/health/jvb-works-v1'
check 404 "all cluster settings" index GET '/_cluster/settings'
check 404 "cluster settings with defaults" index GET '/_cluster/settings?include_defaults=true&flat_settings=true'
check 404 "change cluster settings" index PUT '/_cluster/settings' "$EMPTY"
check 404 "every index" index GET '/_cat/indices'
check 404 "list of indices, other columns" index GET '/_cat/indices/jvb-*?format=json'
check 404 "alias swap" index POST '/_aliases' "$NO_ALIASES"
check 404 "an index's aliases" index GET '/jvb-works-v1/_alias'
check 404 "count with a query string" index GET '/jvb-contacts-v1/_count?q=email:a*'
check 404 "count by POST" index POST '/jvb-contacts-v1/_count' "$Q"
check 404 "delete by wildcard" index DELETE '/jvb-*-v0'
check 404 "delete two indices" index DELETE '/jvb-works-v0,jvb-makers-v0'
check 404 "make an index without a version" index PUT '/jvb-works' "$NO_INDEX"
check 404 "bulk without an index" index POST '/_bulk'
check 404 "bulk with a pipeline" index POST '/jvb-works-v0/_bulk?pipeline=x'
check 404 "bulk waiting for a refresh" index POST '/jvb-works-v0/_bulk?refresh=wait_for'
check 404 "full force merge" index POST '/jvb-contacts-v0/_forcemerge'
check 404 "force merge, other options" index POST '/jvb-contacts-v0/_forcemerge?only_expunge_deletes=true&max_num_segments=1'
check 404 "close an index" index POST '/jvb-works-v0/_close'
check 404 "change an index's settings" index PUT '/jvb-works-v0/_settings' "$EMPTY"
check 404 "delete by query" index POST '/jvb-contacts-v0/_delete_by_query' "$Q"
check 404 "reindex" index POST '/_reindex' "$EMPTY"
check 404 "snapshots" index GET '/_snapshot'
check 404 "SQL plugin" index POST '/_plugins/_sql' "$EMPTY"
check 404 "node details" index GET '/_nodes'
check 404 "tasks" index GET '/_tasks'
check 404 "one document" index GET '/jvb-contacts-v1/_doc/x'

if [ "$fail" = 0 ]; then
  echo "ALL OK"
else
  echo "SOMETHING IS WRONG: do not give the studio the search address until every line says OK"
fi
exit "$fail"

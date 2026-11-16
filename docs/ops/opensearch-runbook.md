# OpenSearch runbook: the studio's search index on the server

Written 16 November 2026 with the studio's OpenSearch change. It is for a
careful person with SSH access to the gallery server; no programming is
needed. Every step says what to do, how to see that it worked, and how to
undo it.

## What this does, in short

The studio searches today by asking Postgres. After this runbook a search
engine, OpenSearch, runs on the same server beside it: it finds "Yōsai" when
someone types "yosai", forgives a slip in a long word ("Similar matches"),
searches makers, provenance and publications, and says where a word was
found. Postgres keeps answering every search as it does today; OpenSearch's
results are added to its results, never put in their place.

- OpenSearch holds a **copy** of what the studio searches. Postgres stays
  the record. The studio keeps the copy up to date within seconds of each
  save, checks it against Postgres every night, and Admin → Search →
  **"Reconcile now"** makes it again from Postgres at any time. So it is
  never backed up, and its data can be deleted without losing anything.
- If OpenSearch is stopped, full or unreachable, the studio searches
  Postgres alone, exactly as today. Nothing else depends on it.
- Only admin and staff searches use it. The accountant, the capture app and
  the website keep searching Postgres only.
- OpenSearch has no password of its own and listens only inside the server.
  The edge server (Caddy) is its one door from the internet, at
  `search.<server name>`, with two logins: `jvb-search`, which can only
  search, and `jvb-index`, which also keeps the copy up to date. Each may
  send a short, fixed list of requests; everything else is turned away
  without reaching OpenSearch. Any other login name, and the search login
  asking for anything but a search, is turned away before a password is
  even checked. There is no address that answers without a password, not
  even a health check.
- The passwords exist only in the password manager and in the studio's
  Vercel settings. The server holds only their hashes, in the Caddyfile.
- It uses about 0.8 GB of memory at its busiest (normal size) and some
  20 MB of disk for the index, plus about 3 GB once for its program (the
  build needs about 1.6 GB more while it runs, which step 5 frees again).
  If the server ever runs short of memory, the kernel stops OpenSearch
  first, not the database or the shared drive.
- What people type into the search box is never stored: OpenSearch's
  query log is not in the program, and the search words travel inside the
  requests, which the edge server's log leaves out.

| Step | What | Interruption | Time |
|---|---|---|---|
| 1 | Check the server has room | none | 5 min |
| 2 | Back up | none | 5 min |
| 3 | Kernel memory-map setting (usually nothing to do) | none | 2 min |
| 4 | Put the new files on the server | none | 10 min |
| 5 | Build and start OpenSearch | none | 10 min |
| 6 | Passwords and the edge server's search site | none | 15 min |
| 7 | Check the search site from outside | none | 5 min |
| 8 | Database change 0100 | none | 10 min |
| 9 | Vercel: give the studio the address and the passwords | none | 10 min |
| 10 | First reconcile, and check search | none | 10 min |

Steps 1 to 7 can be done in one sitting on any day; nothing uses OpenSearch
until step 9. Keep the SSH window of step 6 open until step 7 is finished
(the new passwords are in it). Do steps 8 to 10 together.

## Before you start

You need:

- SSH access to the server as root: `ssh root@104.238.184.145` (add
  `-p <port>` if you normally use another port).
- Vercel: team "Joost van den Bergh Project", project **jvb-studio** (the
  only project that gets the new settings).
- The password manager. The two new passwords go there first.
- A computer with this repository, up to date with `main` after the search
  change was merged (`git pull`), and the studio deployed on Vercel from that
  same `main`. The new code works before this runbook: with no search
  address set, it searches Postgres as before and empties the change queue
  without sending anything.
- The database changes before 0100 already applied on the live database
  (the review fixes' 0097 to 0099 included). Database changes go on in
  number order; if you are not sure, ask whoever looks after the code before
  step 8.
- A choice of address. `search.104-238-184-145.sslip.io` needs no DNS
  record, like the API's address. sslip.io's certificates come from a limit
  that all its users share, so the first certificate can be refused for a
  while; if step 6 hits that, use `search.joostvandenbergh.com` instead,
  with an A record at GoDaddy pointing at `104.238.184.145` (as
  `drive.joostvandenbergh.com` has), made before step 6.

How to read the commands: grey boxes are typed into the server after `ssh`,
unless they say "on your computer". Copy each box whole. Text in `<angle
brackets>` is yours to fill in. Lines starting with `#` are notes and do
nothing.

**Every time you open a new SSH session**, run this first. It moves to the
right folder and sets a few names used below; nothing secret is printed.

```sh
cd /opt/jvb/infra/compose
API=$(grep '^API_EXTERNAL_URL=' .env | cut -d= -f2-)
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
SEARCH_HOST=search.104-238-184-145.sslip.io
echo "API is $API, search is https://$SEARCH_HOST"
```

If you chose your own domain, change the `SEARCH_HOST=` line to
`SEARCH_HOST=search.joostvandenbergh.com`. Check: it prints `API is
https://api.104-238-184-145.sslip.io` and the search address. If the API
part is empty, stop: the server's settings are not where this runbook
expects them.

## Step 1. Check the server has room

Run this at a normal working time (memory use is lowest at night, which
would flatter it). It only reads.

```sh
avail=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
total=$(awk '/^MemTotal:/ {print int($2/1024)}' /proc/meminfo)
swap=$(awk '/^SwapTotal:/ {print int($2/1024)}' /proc/meminfo)
diskfree=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
diskuse=$(df --output=pcent / | tail -1 | tr -dc 0-9)
ooms=$( { journalctl -k --since "-30 days" --no-pager 2>/dev/null || dmesg 2>/dev/null; } | grep -ciE 'out of memory|oom-kill')
port=$(ss -ltnH 'sport = :9200' | wc -l)
echo "memory: $total MB in all, $avail MB available, swap $swap MB"
echo "disk: ${diskuse}% used, ${diskfree} GB free"
echo "out-of-memory events, last 30 days: $ooms"
echo "listening on port 9200 already: $port"
echo "vm.max_map_count: $(sysctl -n vm.max_map_count)"
echo "docker $(docker version --format '{{.Server.Version}}'), compose $(docker compose version --short), caddy $(caddy version | cut -d' ' -f1)"
if [ "$avail" -ge 2500 ]; then echo "MEMORY: OK (normal size)"; elif [ "$avail" -ge 1500 ]; then echo "MEMORY: OK, but use the SMALL size in step 4"; else echo "MEMORY: STOP"; fi
if [ "$diskfree" -ge 10 ] && [ "$diskuse" -le 90 ]; then echo "DISK: OK"; else echo "DISK: STOP"; fi
if [ "$ooms" -eq 0 ]; then echo "OUT-OF-MEMORY HISTORY: OK"; else echo "OUT-OF-MEMORY HISTORY: STOP"; fi
if [ "$port" -eq 0 ]; then echo "PORT 9200: OK"; else echo "PORT 9200: STOP"; fi
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'
```

Write down the memory, disk and `vm.max_map_count` lines.

**Check, and when to stop:**

- `MEMORY: OK (normal size)`: at least 2.5 GB available. Go on.
- `MEMORY: OK, but use the SMALL size`: 1.5 to 2.5 GB available. Go on,
  and do the extra line in step 4.
- `MEMORY: STOP`: under 1.5 GB available. Do not install it: OpenSearch
  would push the server into running out of memory, and the first things to
  suffer are photographs being processed and the shared drive's encrypted
  mount (it has died of that before, `infra/README.md` §6c). Tell whoever
  looks after the code, with the last table (memory per service).
- `DISK: STOP`: under 10 GB free, or more than 90% used. Free space first
  (`PROJECT_STATUS.md`, "Server disk"), then start again.
- `OUT-OF-MEMORY HISTORY: STOP`: the server has already run out of memory
  this month. Do not add to it; tell whoever looks after the code.
- `PORT 9200: STOP`: something already uses the port. Stop and ask.
- caddy must be `v2.8` or later (the Caddyfile already uses `basic_auth`,
  which needs it). If it is older, stop and ask.
- Do **not** turn swap off, whatever the OpenSearch guide says
  (`swapoff -a`): that takes it away from every service on the server.
  OpenSearch's own container is kept from swapping instead.

**Undo:** nothing to undo.

## Step 2. Back up

```sh
B=/root/opensearch-backup-$(date +%Y%m%d-%H%M)
mkdir -p "$B" && chmod 700 "$B"
cp -a docker-compose.yml .env /etc/caddy/Caddyfile "$B"/
ls -la "$B"
echo "Backup folder: $B"
/opt/jvb/infra/scripts/backup.sh db
```

Write down the backup folder's name. The undo commands below use `$B`; in a
new SSH session set it again first: `B=/root/opensearch-backup-<what you
wrote down>`.

**Check:** the listing shows `.env`, `Caddyfile` and `docker-compose.yml`,
and the database backup ends with `db backup complete`.

**Undo:** nothing to undo. The folder holds secrets and only root can read
it; delete it a week after the last step (`rm -r "$B"`).

## Step 3. Kernel memory-map setting

OpenSearch asks for `vm.max_map_count` of at least 262144. Ubuntu 24.04,
which this server runs, already sets 1048576, so this is normally nothing.
Look at the value step 1 printed:

- **262144 or more** (for example `1048576`): nothing to do. Do not write
  262144 anyway: that would lower the value for the whole server.
- **Less than 262144**: raise it, and keep it raised after a restart:

  ```sh
  printf 'vm.max_map_count = 262144\n' > /etc/sysctl.d/60-opensearch.conf
  sysctl --system >/dev/null
  sysctl -n vm.max_map_count
  ```

**Check:** `sysctl -n vm.max_map_count` prints `262144` or more.

**Undo** (only if you made the file): `rm /etc/sysctl.d/60-opensearch.conf
&& sysctl --system >/dev/null`. The old value returns at the next restart.

## Step 4. Put the new files on the server

1. On your computer, in the repository folder. The build folder goes first:
   a compose file that names a build folder the server does not have makes
   a plain `docker compose up -d` start nothing at all, not even the
   database.

   ```sh
   ssh root@104.238.184.145 'install -d /opt/jvb/infra/compose/opensearch'
   scp infra/compose/opensearch/Dockerfile root@104.238.184.145:/opt/jvb/infra/compose/opensearch/Dockerfile
   scp infra/scripts/verify-search-edge.sh root@104.238.184.145:/opt/jvb/infra/scripts/verify-search-edge.sh
   scp infra/compose/docker-compose.yml root@104.238.184.145:/opt/jvb/infra/compose/docker-compose.yml.new
   scp infra/compose/Caddyfile root@104.238.184.145:/opt/jvb/infra/compose/Caddyfile.repo
   ```

2. On the server, compare the compose file with the live one:

   ```sh
   ls -la opensearch/Dockerfile /opt/jvb/infra/scripts/verify-search-edge.sh
   diff docker-compose.yml docker-compose.yml.new
   ```

   Lines starting with `>` are only in the new file, lines starting with `<`
   only in the live one.

   - If the `>` lines are just the `opensearch:` block with its comments, the
     changed comment at the top about the exposure model, the line
     `  opensearch-data:` and the three lines `  search:`, its comment and
     `    driver: bridge`, and the only `<` lines are that old top comment,
     use the new file:

     ```sh
     mv docker-compose.yml.new docker-compose.yml
     ```

   - Otherwise (the live file differs elsewhere too, for example a pinned
     dashboard image), keep the live file and add the three parts by hand:
     `nano docker-compose.yml`; copy the `opensearch:` block from
     `docker-compose.yml.new` (from its comment line of dashes to the line
     `max-file: "3"`) and paste it just above the line `volumes:` that
     starts at the left edge, keeping every line's spaces exactly; under
     that `volumes:` add a line `  opensearch-data:` (two spaces); under
     `networks:` at the end add `  search:` and, below it, `    driver:
     bridge` (two and four spaces). Save with Ctrl+O, Enter, leave with
     Ctrl+X. Then `rm docker-compose.yml.new`.

3. Add the memory size and the two login names to `.env` (no password goes
   there):

   ```sh
   grep -q '^OPENSEARCH_HEAP=' .env || printf '\n# OpenSearch (docs/ops/opensearch-runbook.md)\nOPENSEARCH_HEAP=512m\nOPENSEARCH_MEM_LIMIT=1g\nOPENSEARCH_SEARCH_USER=jvb-search\nOPENSEARCH_INDEX_USER=jvb-index\n' >> .env
   ```

   **Only if step 1 said SMALL size**, also run:

   ```sh
   sed -i -e 's/^OPENSEARCH_HEAP=.*/OPENSEARCH_HEAP=256m/' -e 's/^OPENSEARCH_MEM_LIMIT=.*/OPENSEARCH_MEM_LIMIT=768m/' .env
   ```

**Check:**

```sh
grep -E '^(OPENSEARCH_HEAP|OPENSEARCH_MEM_LIMIT|OPENSEARCH_SEARCH_USER|OPENSEARCH_INDEX_USER)=' .env
docker compose config --quiet && echo "compose file OK"
docker compose config opensearch | grep -E 'OPENSEARCH_JAVA_OPTS|mem_limit|host_ip|published|context:'
```

Expect the four settings (`512m` and `1g`, or `256m` and `768m`, then
`jvb-search` and `jvb-index`), then `compose file OK`, then five lines:
`-Xms512m -Xmx512m` (or 256m), `mem_limit: "1073741824"` (or
`"805306368"`), a `context:` ending in `/compose/opensearch`,
`host_ip: 127.0.0.1` and `published: "9200"`.

**Undo:**

```sh
cp -a "$B/docker-compose.yml" docker-compose.yml
cp -a "$B/.env" .env
```

Leave the `opensearch` folder until OpenSearch is removed (see "Removing
OpenSearch completely").

## Step 5. Build and start OpenSearch

```sh
docker compose build opensearch
docker compose up -d opensearch
docker builder prune -af
```

The build downloads OpenSearch (about 1.2 GB; a few minutes) and removes
its add-ons. `up -d opensearch` starts only this one service; nothing else
restarts. The last line deletes what Docker kept from the build to make a
second build quicker (about 1.6 GB, measured; `docker image ls` does not
show it). The program itself, about 2.9 GB, stays. It also deletes the
image worker's build leftovers, which does no harm: they are made again
the next time the image worker is built.

**Check:**

```sh
for i in $(seq 1 30); do s=$(docker inspect -f '{{.State.Health.Status}}' jvb-opensearch 2>/dev/null); [ "$s" = healthy ] && break; sleep 5; done; echo "opensearch: $s"
curl -s 'http://127.0.0.1:9200/_cluster/health?filter_path=status,number_of_nodes'; echo
curl -s 'http://127.0.0.1:9200/_cat/plugins'; echo "(nothing above this line is right)"
curl -s 'http://127.0.0.1:9200/_cluster/settings?include_defaults=true&flat_settings=true' | grep -oE '"(rest\.action\.multi\.allow_explicit_index|action\.auto_create_index|action\.destructive_requires_name|script\.allowed_types|http\.max_content_length|cluster\.default_number_of_replicas|cluster\.routing\.allocation\.disk\.watermark\.(low|high|flood_stage))":("[^"]*"|\[[^]]*\])'
docker inspect -f '{{range $n, $c := .NetworkSettings.Networks}}{{$n}} {{end}}' jvb-opensearch; echo
docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' jvb-supabase_search; echo
ss -ltn | grep -E ':(9200|9300|9600) '
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' jvb-opensearch
docker compose ps
awk '/^MemAvailable:/ {print int($2/1024) " MB available"}' /proc/meminfo
docker system df --format '{{.Type}}: {{.Size}}' | grep 'Build Cache'
```

Expect, in order:

- `opensearch: healthy` (it takes about 20 seconds);
- `{"status":"green","number_of_nodes":1}`;
- no add-ons listed above the line in brackets;
- these nine settings, exactly (the edge server relies on the first five:
  no request may name another index inside its body, no jvb- index is made
  by accident, no deleting by wildcard, no scripts, nothing larger than
  20 MB):

  ```
  "action.auto_create_index":"-jvb-*,+*"
  "action.destructive_requires_name":"true"
  "cluster.default_number_of_replicas":"0"
  "cluster.routing.allocation.disk.watermark.flood_stage":"2gb"
  "cluster.routing.allocation.disk.watermark.high":"3gb"
  "cluster.routing.allocation.disk.watermark.low":"4gb"
  "http.max_content_length":"20mb"
  "rest.action.multi.allow_explicit_index":"false"
  "script.allowed_types":["none"]
  ```

- `jvb-supabase_search` and nothing else (OpenSearch is on its own network),
  then `jvb-opensearch` and nothing else (no other container is on it);
- one line for `127.0.0.1:9200` and nothing else (never `0.0.0.0`, `*` or
  `[::]`, and no 9300 or 9600);
- memory of about 0.75 GiB out of 1 GiB (about 0.5 out of 0.75 for the small
  size);
- every other service still `Up` (and `healthy` where shown);
- still at least 800 MB available. If less than 800 MB is available, undo,
  and either repeat with the small size (step 4's extra line) or stop;
- `Build Cache: 0B` (or a few kB).

If it never becomes healthy: `docker compose logs --tail=40 opensearch`
names the problem. Undo, and tell whoever looks after the code with those
lines.

**Undo:**

```sh
docker compose stop opensearch && docker compose rm -f opensearch
```

The data volume and the program stay; "Removing OpenSearch completely"
clears them.

## Step 6. Passwords and the edge server's search site

What changes: `/etc/caddy/Caddyfile` gains the search site (Appendix B),
with your address and the hashes of two new passwords (Caddy never holds the
passwords themselves). Keep this SSH window open until step 7 is done: the
passwords exist only in it and in the password manager.

1. Make the two passwords and their hashes:

   ```sh
   grep -q '^search\.' /etc/caddy/Caddyfile && echo "STOP: a search site is already in the Caddyfile"
   if caddy hash-password --help 2>&1 | grep -q -- '--bcrypt-cost'; then HASHER='caddy'; else HASHER='docker run --rm -i caddy:2.11.9 caddy'; fi
   SEARCH_PW=$(openssl rand -hex 24); INDEX_PW=$(openssl rand -hex 24)
   SEARCH_HASH=$(printf '%s' "$SEARCH_PW" | $HASHER hash-password --bcrypt-cost 10)
   INDEX_HASH=$(printf '%s' "$INDEX_PW" | $HASHER hash-password --bcrypt-cost 10)
   echo "hashes: ${#SEARCH_HASH} and ${#INDEX_HASH} characters, starting ${SEARCH_HASH:0:7} and ${INDEX_HASH:0:7}"
   ```

   Expect no `STOP` line and `hashes: 60 and 60 characters, starting
   $2a$10$ and $2a$10$`. The passwords are 48 random letters and digits
   (nothing to quote).

   Why cost 10 and not Caddy's usual 14: every password Caddy checks takes
   processor time, almost a second at 14 and about 0.06 s at 10 (both
   measured), and a 48-character random password loses nothing by the
   cheaper hash. Caddy checks a password even when the login name is not
   one it knows, against a hash of its own at cost 14, and the hashes made
   here cannot change that. So the search site turns away, before any
   password is checked, every name other than `jvb-search` and
   `jvb-index`, and the search login asking for anything but a search.
   Without that, anyone on the internet could keep the server's four
   processors busy with a few made-up logins a second. What is left is
   0.06 s for each wrong password given with one of the two real names;
   step 7's script checks that the rest is turned away at once.

   Caddy older than 2.10 cannot choose the cost, so the box then borrows a
   current Caddy for this one command (a small download); the hash works
   in any Caddy.

2. Save the passwords: show them, copy them into a new password-manager
   entry "JVB search logins" (two lines: `jvb-search` with its password,
   `jvb-index` with its password), then clear the screen:

   ```sh
   echo "jvb-search: $SEARCH_PW"
   echo "jvb-index:  $INDEX_PW"
   clear
   ```

   They are not written anywhere on the server.

3. Make the site from the repository's copy, with your address and the two
   hashes:

   ```sh
   awk -v host="$SEARCH_HOST" -v sh="$SEARCH_HASH" -v ih="$INDEX_HASH" '
     /^# OpenSearch, the studio.s search index/ { p = 1 }
     p && /^search\.example\.com [{]$/ { $0 = host " {" }
     p { gsub(/[$]2a[$]10[$]CHANGE_ME_bcrypt_hash_for_jvb-search/, sh); gsub(/[$]2a[$]10[$]CHANGE_ME_bcrypt_hash_for_jvb-index/, ih); print }
     p && /^}$/ { exit }' Caddyfile.repo > /root/search-site.caddy
   grep -c '' /root/search-site.caddy; grep -c CHANGE_ME /root/search-site.caddy; grep -c '[$]2a[$]10[$]' /root/search-site.caddy; grep -n ' {$' /root/search-site.caddy | head -1
   ```

   Expect about `176` lines; `0` (no placeholder left); `4` (the four hash
   lines); and a line ending `search.<your address> {`.

4. Make the log file, owned by Caddy's user (a root-owned file makes the
   reload fail while the old settings keep running), add the site, check it
   and load it:

   ```sh
   [ -d /var/log/caddy ] || install -d -m 755 -o caddy -g caddy /var/log/caddy
   [ -e /var/log/caddy/search-access.log ] || install -m 640 -o caddy -g caddy /dev/null /var/log/caddy/search-access.log
   if grep -q '^search\.' /etc/caddy/Caddyfile; then echo "STOP: a search site is already there; not added twice"; else printf '\n' >> /etc/caddy/Caddyfile && cat /root/search-site.caddy >> /etc/caddy/Caddyfile; fi
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy && echo "caddy reloaded"
   rm /root/search-site.caddy Caddyfile.repo
   ```

   Expect `Valid configuration` and `caddy reloaded`. If validation prints
   an error, nothing was loaded and the old settings are still running:
   undo.

**Check** (Caddy fetches the certificate on the first request; give it a
minute):

```sh
sleep 30
curl -s -o /dev/null -w 'search without a password: %{http_code}\n' -X POST "https://$SEARCH_HOST/jvb-works-v1/_search"
curl -s -o /dev/null -w 'front page: %{http_code}\n' "https://$SEARCH_HOST/"
printf 'user = "jvb-index:%s"\n' "$INDEX_PW" | curl -K - -s -o /dev/null -w 'health with the index login: %{http_code}\n' "https://$SEARCH_HOST/_cluster/health"
printf 'user = "jvb-search:%s"\n' "$SEARCH_PW" | curl -K - -s -o /dev/null -w 'health with the search login: %{http_code}\n' "https://$SEARCH_HOST/_cluster/health"
curl -s -o /dev/null -w 'a made-up login: %{http_code} in %{time_total} s\n' -u 'nobody:x' -X POST "https://$SEARCH_HOST/jvb-works-v1/_search"
curl -s -o /dev/null -w 'API: %{http_code}\n' "$API/auth/v1/health" -H "apikey: $ANON"
```

The two passwords go to curl on its input (`-K -`), not on its command
line, where any other account on the server could read them while curl
runs.

Expect `search without a password: 401`, `front page: 404`,
`health with the index login: 200`, `health with the search login: 401`
(that login may only search), `a made-up login: 401` in a few hundredths
of a second (about a second means a password was checked that should
have been refused before: undo, and tell whoever looks after the code),
`API: 200`.

If the first lines are `000` or a certificate error: wait two minutes and
run the box again. If it persists,
`journalctl -u caddy --since "-10 min" --no-pager | grep -iE 'certificate|rate|error' | tail -5`
tells why. `rateLimited` or `too many certificates` means the shared
sslip.io limit: make the GoDaddy record for `search.joostvandenbergh.com`,
then `nano /etc/caddy/Caddyfile`, change the search site's first line to
`search.joostvandenbergh.com {`, save, validate and reload as above, and set
`SEARCH_HOST=search.joostvandenbergh.com`.

**Undo:**

```sh
cp -a "$B/Caddyfile" /etc/caddy/Caddyfile && systemctl reload caddy
```

The passwords in the password manager are then unused; delete the entry.

## Step 7. Check the search site from outside

1. Still in the SSH window of step 6, run the check script. It sends about
   95 requests to the search site, with no login, a wrong password, a
   made-up name or one of the two logins, and says for each one who
   answered (`edge`: the edge server itself; `login`: the edge server's
   password check; `engine`: OpenSearch) and whether that is right. It
   only reads: nothing is created, changed or deleted, and it prints no
   password.

   ```sh
   SEARCH_PW="$SEARCH_PW" INDEX_PW="$INDEX_PW" BASE="https://$SEARCH_HOST" /opt/jvb/infra/scripts/verify-search-edge.sh
   ```

   Expect every line to start with `OK` and the last line to say `ALL OK`.
   Lines saying `engine 404` are right at this point: the indexes are made
   in step 10. Then forget the passwords in this window:

   ```sh
   unset SEARCH_PW INDEX_PW SEARCH_HASH INDEX_HASH
   ```

2. On your computer (not the server), check that OpenSearch's own ports
   cannot be reached:

   ```sh
   curl -s -m 5 -o /dev/null http://104.238.184.145:9200/ && echo "port 9200: OPEN - undo step 5 and ask" || echo "port 9200: closed (right)"
   curl -s -m 5 -o /dev/null http://104.238.184.145:9300/ && echo "port 9300: OPEN - undo step 5 and ask" || echo "port 9300: closed (right)"
   ```

   Expect both closed. The check script also runs from your computer, in
   the repository folder: `BASE=https://<search address>
   infra/scripts/verify-search-edge.sh` asks for the two passwords (paste
   them from the password manager; nothing shows as you paste).

If any line says `WRONG`: do not go on to step 9. Undo step 6 and tell
whoever looks after the code, with the script's output (it holds no
password).

**Undo:** nothing to undo.

## Step 8. Database change 0100

The change adds the queue that tells the studio which records changed, so
the index follows edits within seconds, and the small table where the
studio notes its last reconcile. It stores record numbers only, never what
the records say. Apply it through the SSH tunnel exactly as
`docs/ops/security-runbook.md` step 5.4 describes. On your computer, first
window (prints nothing and looks frozen; leave it open):

```sh
ssh -N -L 54322:127.0.0.1:5432 root@104.238.184.145
```

Second window, in the repository folder:

```sh
CHECK=1 scripts/apply-migrations.sh 0100
scripts/apply-migrations.sh 0100
```

The first lists the file (`supabase/migrations/0100_search_outbox.sql`)
and changes nothing; the second applies it (it asks for
`POSTGRES_PASSWORD`, which is in the password manager) and ends with `All
applied. The API has reloaded its schema.` Close the first window when
done.

**Check:** on the server,

```sh
docker compose exec -T db psql -U supabase_admin -d postgres -At -c "select count(*) from public.search_outbox" -c "select count(*) from public.search_state"
```

prints two small numbers (the first may be anything from 0 upwards: the
studio empties the queue as it fills, and with no search address yet it
sends nothing). An error such as `relation "public.search_outbox" does not
exist` means the change did not go in: read the second window's output.

**Undo:** leave it in place; with no search address set, the studio empties
the queue without sending anything. To remove it entirely, ask whoever
looks after the code for the reverse change.

## Step 9. Vercel: give the studio the address and the passwords

In **jvb-studio** only: Settings → Environment Variables → Add, each for
**Production only** (untick Preview and Development), each with
"Sensitive" ticked:

| Name | Value |
|---|---|
| `OPENSEARCH_URL` | `https://search.104-238-184-145.sslip.io` (your address; `https://`, no `/` at the end, no name or password in it) |
| `OPENSEARCH_SEARCH_USER` | `jvb-search` |
| `OPENSEARCH_SEARCH_PASSWORD` | the `jvb-search` password from the password manager |
| `OPENSEARCH_INDEX_USER` | `jvb-index` |
| `OPENSEARCH_INDEX_PASSWORD` | the `jvb-index` password from the password manager |

Not capture and not jvb-web: neither uses the search index. Not Preview: a
preview deployment uses the live database, and its reconcile would make
and delete the live indexes to suit whatever that preview's code expects.
Without the address, a preview searches Postgres as today.

Then redeploy: Deployments → the latest Production deployment → ⋯ →
Redeploy (the build cache may stay ticked: these settings are read by the
server, not built into the pages). Wait for "Ready".

**Check:** in the studio, Admin → Search shows the engine as "ok". The
indexes may still be missing or empty; step 10 makes them. Searches still
work throughout (Postgres answers).

**Undo:** delete the five variables and redeploy. The studio searches
Postgres alone again and empties the queue without sending anything.

## Step 10. First reconcile, and check search

In the studio: Admin → Search → **Reconcile now**. It takes under a
minute. (The studio would also make the indexes by itself on the first
change it sends, and the nightly reconcile at 02:17 UTC repeats this every
night.)

**Check:**

- Admin → Search: the engine is "ok"; each index (works, makers, contacts)
  shows the same number of documents as the database count beside it;
  pending changes are 0 or close to it; "last reconcile" is now, with no
  error.
- Cmd-K, as an admin or staff member:
  - type a maker's name without its accents (for example `yosai` for
    Yōsai, `shoji` for Shōji): that maker and their works appear;
  - type a stock number in full: exactly that work comes first;
  - type a name with two letters swapped (for example `Yosia`): works
    appear under "Similar matches".
- Edit a test work's title (add a word), save, wait half a minute, and
  search for that word: the work appears. Put the title back.
- On the server:

  ```sh
  curl -s 'http://127.0.0.1:9200/_cat/indices/jvb-*?v&h=health,index,docs.count,store.size&s=index'
  curl -s 'http://127.0.0.1:9200/_cat/aliases'; echo "(nothing above this line is right)"
  curl -s 'http://127.0.0.1:9200/_cat/indices/top_queries*'; echo "(nothing above this line is right)"
  ```

  Three indexes, `jvb-contacts-v1`, `jvb-makers-v1` and `jvb-works-v1` (or
  higher numbers after a later change), each `green`; no aliases; no query
  log. Run the third line again the next day: still nothing.

**Undo:** step 9's undo (the studio stops using OpenSearch).

## Afterwards

- Ask whoever keeps the project notes to record the date, the address and
  the size chosen (normal or small) in `PROJECT_STATUS.md`, and the
  `search.` address in `infra/README.md` §2.
- Delete the backup folder from step 2 a week later.

## If Admin → Search says the disk is nearly full, or the index is read-only

Cause: the server's disk is nearly full. With under 3 GB free, OpenSearch
refuses to make new indexes, so a reconcile that needs one stops and keeps
the old index. With under 2 GB free, it refuses every change to the index,
to protect itself: searches keep working but show the index as it was, and
changes wait. So that a contact's erasure is never stuck behind this, the
studio then deletes the whole contacts index instead, and contact search
uses Postgres alone until the next reconcile makes it again.

1. See how full the disk is: `df -h /`.
2. Free space (`PROJECT_STATUS.md`, "Server disk": delete on the server,
   never from a synced Mac).
3. OpenSearch notices within a few minutes of more than 3 GB being free
   and lifts both blocks by itself (the read-only one first). Check:

   ```sh
   curl -s 'http://127.0.0.1:9200/_cluster/settings?flat_settings=true'; echo
   curl -s 'http://127.0.0.1:9200/jvb-*/_settings/index.blocks*?flat_settings=true'; echo
   ```

   Neither should mention `create_index` or `read_only_allow_delete`.
4. Admin → Search → Reconcile now. It sends whatever waited and makes the
   contacts index again if it was deleted.

Do not switch the disk guard off to make the message go away; the disk is
what needs attention, for the database's sake too.

**Undo:** nothing to undo.

## If OpenSearch is down or unhealthy

The studio keeps working and searches Postgres meanwhile; changes wait in
the queue.

```sh
docker compose ps opensearch
docker compose logs --tail=40 opensearch
docker inspect -f 'restarts={{.RestartCount}} out-of-memory={{.State.OOMKilled}}' jvb-opensearch
```

- Not running: `docker compose up -d opensearch`, then step 5's check.
- `out-of-memory=true`: it reached its limit. If step 1's memory check
  still passes for the normal size, set `OPENSEARCH_MEM_LIMIT=1280m` in
  `.env` (`nano .env`), then `docker compose up -d opensearch`; if not, use
  the small size.
- Anything else, or it keeps restarting: start it afresh. This deletes only
  the copy:

  ```sh
  docker compose stop opensearch && docker compose rm -f opensearch
  docker volume rm jvb-supabase_opensearch-data
  docker compose up -d opensearch
  ```

  then step 5's check and Admin → Search → Reconcile now.

After a server restart, `docker compose ps` shows it with the rest; like
every container here it waits for the shared drive's encrypted mount
(`infra/README.md` §6c), because Docker itself does.

**Undo:** nothing to undo.

## Changing a search password

Do this once a year, when someone who knew a password leaves, or at once if
a password may have leaked (then change both, and see
`docs/compliance/BREACH_PROCEDURE.md`: with the search password someone
could look names up in the contacts index one guess at a time). Search
keeps working throughout: between steps 2 and 3 the studio searches
Postgres alone, and changes wait in the queue.

1. On the server, after the usual first commands, choose the login and make
   its new password and hash:

   ```sh
   WHO=jvb-search      # or: WHO=jvb-index
   if caddy hash-password --help 2>&1 | grep -q -- '--bcrypt-cost'; then HASHER='caddy'; else HASHER='docker run --rm -i caddy:2.11.9 caddy'; fi
   NEW_PW=$(openssl rand -hex 24)
   NEW_HASH=$(printf '%s' "$NEW_PW" | $HASHER hash-password --bcrypt-cost 10)
   echo "$WHO: $NEW_PW"
   ```

   Put the new password in the password manager entry "JVB search logins"
   (keep the old one in the entry's notes until step 4 says OK), then
   `clear`.

2. Put the new hash in the Caddyfile and load it:

   ```sh
   cp -a /etc/caddy/Caddyfile /root/Caddyfile.before-password-change
   awk -v who="$WHO" -v h="$NEW_HASH" '$1 == who { sub(/[$]2[aby][$][0-9][0-9][$][./A-Za-z0-9]*/, h) } { print }' /root/Caddyfile.before-password-change > /etc/caddy/Caddyfile
   grep -c -F "$NEW_HASH" /etc/caddy/Caddyfile
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy && echo "caddy reloaded"
   ```

   Expect `1` for `jvb-search` or `3` for `jvb-index` (it appears in three
   parts of the site), `Valid configuration` and `caddy reloaded`.

3. Vercel jvb-studio → Settings → Environment Variables →
   `OPENSEARCH_SEARCH_PASSWORD` (for `jvb-search`) or
   `OPENSEARCH_INDEX_PASSWORD` (for `jvb-index`) → Edit → the new password
   → Save. Then redeploy the latest Production deployment and wait for
   "Ready".

4. **Check:** run the check script of step 7. It asks for both passwords
   (paste them from the password manager, the new one for `$WHO`; nothing
   shows as you paste):

   ```sh
   BASE="https://$SEARCH_HOST" /opt/jvb/infra/scripts/verify-search-edge.sh
   ```

   Every line `OK`, then `ALL OK`. Admin → Search shows the engine "ok";
   after changing the `jvb-index` password, also press Reconcile now. Then
   delete the old password from the password manager, and on the server
   `rm /root/Caddyfile.before-password-change`.

**Undo:**

```sh
cp -a /root/Caddyfile.before-password-change /etc/caddy/Caddyfile && systemctl reload caddy
```

and put the old password back in the Vercel variable and redeploy.

To see who has used the search site (for example after a suspected leak),
on the server:

```sh
grep -o '"remote_ip":"[^"]*"' /var/log/caddy/search-access.log | sort | uniq -c | sort -rn | head
grep -oE '"method":"[^"]*"|"uri":"[^"]*"|"user_id":"[^"]*"|"status":[0-9]+' /var/log/caddy/search-access.log | paste - - - - | sort | uniq -c | sort -rn | head -20
```

The first lists the calling addresses (the studio's are Vercel's); the
second, how often each request was made, by which login (empty when no
correct password came with it) and with what answer. The log holds no
search words and no passwords. Caddy keeps the current file and three
older ones beside it, compressed (read those with `zgrep` in place of
`grep`).

## Upgrading OpenSearch

The program is pinned in `infra/compose/opensearch/Dockerfile` (version and
fingerprint on the `FROM` line). Whoever looks after the code changes that
line and checks the add-on removal still works; then on the server:

1. On your computer: `scp infra/compose/opensearch/Dockerfile root@104.238.184.145:/opt/jvb/infra/compose/opensearch/Dockerfile`
2. On the server:

   ```sh
   docker compose build --pull opensearch
   docker compose stop opensearch && docker compose rm -f opensearch
   docker volume rm jvb-supabase_opensearch-data
   docker compose up -d opensearch
   ```

3. Step 5's check, then Admin → Search → Reconcile now.
4. Get the disk space back. The old program (about 3 GB) has lost its
   name to the new one (`docker image ls` shows it as `<none>`, if at
   all), and the build left the downloaded original behind as well (1.5 to
   3 GB, which `docker image ls` never shows):

   ```sh
   docker image prune -f
   docker builder prune -af
   docker system df --format '{{.Type}}: {{.Size}}'
   ```

   The first deletes programs that have no name and that no container
   uses; the second deletes every build's leftovers, the image worker's
   too, which does no harm (they are made again the next time it is
   built).

Starting from an empty volume every time means no version can trip over
data another version wrote (OpenSearch cannot open data a newer version
wrote, so "go back to the old line" alone never works), and going back is
the same steps with the old `Dockerfile`. Search uses Postgres alone for
the minute in between.

**Check:** step 5's check and Admin → Search, as above. The last command
of point 4 shows `Build Cache: 0B` (or a few kB), and
`docker image ls --format '{{.Repository}} {{.ID}}' | grep -iE 'opensearch|none'`
shows one line, `jvb-supabase-opensearch`.

**Undo:** the same four steps with the old `Dockerfile`.

## Removing OpenSearch completely

1. Step 9's undo (Vercel), and wait for the redeploy.
2. The edge server: `nano /etc/caddy/Caddyfile`, delete the search site
   (from the comment line `# OpenSearch, the studio's search index` to the
   `}` that closes the `search.` block), save, then
   `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy`.
3. The service and its data:

   ```sh
   docker compose stop opensearch && docker compose rm -f opensearch
   docker volume rm jvb-supabase_opensearch-data
   ```

4. Take the block out of `docker-compose.yml` (or put back the step 2 copy
   if nothing else changed since: `cp -a "$B/docker-compose.yml" .`), then
   `docker compose config --quiet && echo OK`, and only then
   `rm -r opensearch` (the folder) and `docker network rm jvb-supabase_search`.
5. The program (about 3 GB), any older one an upgrade left without a
   name, and the build's leftovers (1.5 to 3 GB, which `docker image ls`
   never shows):

   ```sh
   docker image rm jvb-supabase-opensearch
   docker image prune -f
   docker builder prune -af
   docker system df --format '{{.Type}}: {{.Size}}'
   ```

   The last line should show `Build Cache: 0B` (or a few kB). The build
   leftovers of the image worker go too, which does no harm: they are made
   again the next time it is built.
6. If step 3 made `/etc/sysctl.d/60-opensearch.conf`, remove it.
7. Delete the "JVB search logins" entry from the password manager.

The database change 0100 can stay: with no search address set, the studio
empties the queue without sending anything.

**Check:** `docker compose ps` lists no `opensearch`;
`docker image ls --format '{{.Repository}} {{.ID}}' | grep -iE 'opensearch|none'`
prints nothing; `curl -s -o /dev/null -w '%{http_code}\n' https://<search address>/`
fails to connect or gives a certificate error; the studio's search works
(Postgres).

**Undo:** this runbook from step 4.

## Why there is no backup

Everything in OpenSearch is made from Postgres, which is backed up nightly.
The nightly backup (`infra/scripts/backup.sh`) never reads Docker volumes,
so the OpenSearch volume is not in it, and the restore drill does not need
it. On a new server, `docker compose up -d` builds and starts OpenSearch
with the rest (allow for the 1.2 GB download); then steps 6, 7 and 9 for
the search site and the studio's settings, and Admin → Search → Reconcile
now. If the new server's Caddyfile was copied whole from the repository
(as `infra/scripts/bootstrap.sh` does), it already holds the search site
with `search.example.com` and the two placeholders, which let nobody in;
step 6's first line then says STOP. Delete that site first, as in
"Removing OpenSearch completely" point 2, and then do step 6 as written.

## Appendix A: the compose block

The repository's `infra/compose/docker-compose.yml`: the `opensearch:`
service, with `opensearch-data:` under `volumes:` and the `search:` network
under `networks:`. `apps/studio/src/app/login/search-edge-config.test.ts`
fails if the settings the edge server relies on change.

What the settings do, in order: built from `./opensearch/Dockerfile` with no
image name (so `docker compose pull` skips it); on its own network and
published on `127.0.0.1:9200` only; one node with no copies
(`discovery.type`, no replicas, so it reports green); the memory size from
`.env`; the Java garbage-collection log replaced by warnings in the normal
log (the image's own would grow to 2 GB inside the container); no security
plugin and no demo users; the disk guard counted in GB free instead of
percent (below); no request naming another index in its body, no jvb- index
made by accident, no deleting by wildcard, no scripts, nothing larger than
20 MB; at most 1 GB of memory and never swap; first to be stopped if the
server runs out of memory; one and a half processors at most; data in a
Docker volume; no extra privileges; a health check (Docker shows
"unhealthy" when the index is broken; it does not restart it); the log kept
to 30 MB.

| Disk guard | OpenSearch's default | Here |
|---|---|---|
| Stops placing copies (meaningless with one node) | 85% used | under 4 GB free |
| Refuses to make indexes (a reconcile that needs one stops) | 90% used | under 3 GB free |
| Index read-only (changes wait; the contacts index is deleted on an erasure) | 95% used | under 2 GB free |

On this 240 GB disk the defaults would bite at 24 GB free; the server was
at 94% (about 14 GB free) in September 2026. The index itself is about
20 MB.

## Appendix B: the edge server's search site

The repository's `infra/compose/Caddyfile` block that begins
`# OpenSearch, the studio's search index`, with `search.example.com`
replaced by your address and the two hashes in place of the placeholders
(step 6 does both). The test named above reads the block and runs a long
list of requests against it; `infra/scripts/verify-search-edge.sh` checks
the live site the same way.

What the parts do, in order: each request is logged to
`/var/log/caddy/search-access.log` (kept to 40 MB) without the password and
without the search words; any address written in other than its plain form
(percent-encoding, doubled slashes, `.` or `..`) gets "Bad request", so
Caddy and OpenSearch always read the same address; a login name other
than `jvb-search` and `jvb-index`, and the search login asking for
anything but a search, get "Unauthorized" (401) at once, before any
password is checked (step 6, point 1, says why); then only these get
through, each with the login shown, each with a size limit, and with the
password taken off before OpenSearch sees the request:

| Request (exactly; `<kind>` is works, makers or contacts, `<n>` a number) | `jvb-search` | `jvb-index` | Largest body |
|---|---|---|---|
| `POST /jvb-<kind>-v<n>/_search` | yes | yes | 64 KB |
| `POST /jvb-<kind>-v<n>/_bulk`, optionally `?refresh=true` or `?refresh=false` | | yes | 16 MB |
| `PUT /jvb-<kind>-v<n>` and `DELETE /jvb-<kind>-v<n>` | | yes | 1 MB |
| `POST /jvb-<kind>-v<n>/_refresh` | | yes | 1 MB |
| `POST /jvb-<kind>-v<n>/_forcemerge?only_expunge_deletes=true` | | yes | 1 MB |
| `GET /jvb-<kind>-v<n>/_count`, `/_mapping`, `/_settings` | | yes | 1 MB |
| `GET /_cluster/health` | | yes | 1 MB |
| `GET /_cluster/settings?flat_settings=true` | | yes | 1 MB |
| `GET /_cat/indices/jvb-*?format=json&h=index,health,docs.count,docs.deleted,store.size` | | yes | 1 MB |

A listed request with no login, or with a wrong password, gets 401 with a
password prompt. Everything else gets "Not found" (404) without a
password prompt: other indexes, two indexes at once, wildcards, any other
query string, aliases, changes to the cluster's settings, snapshots,
tasks, node details, scroll, scripts, single documents. There is no
health check without a password.

## Appendix C: what changed in the repository

- `infra/compose/opensearch/Dockerfile`: the pinned OpenSearch 3.9.0 image
  with its add-ons removed.
- `infra/compose/docker-compose.yml`: the `opensearch` service, the
  `opensearch-data` volume, the `search` network.
- `infra/compose/.env.example`: `OPENSEARCH_HEAP`, `OPENSEARCH_MEM_LIMIT`,
  `OPENSEARCH_SEARCH_USER`, `OPENSEARCH_INDEX_USER` (no passwords).
- `infra/compose/Caddyfile`: the search site, with placeholders for the two
  hashes.
- `infra/scripts/verify-search-edge.sh`: the read-only check of step 7.
- `apps/studio/src/app/login/search-edge-config.test.ts`: fails the tests
  if the search site lets through anything but the shapes above, to any
  login but the one shown, if any request with any login name could make
  the edge check a password against Caddy's own slow hash, if the engine
  settings it relies on change, or if the check script's expectations stop
  matching it.
- `supabase/migrations/0100_search_outbox.sql`: the change queue and the
  reconcile record (step 8).
- `docs/ops/security-runbook.md` step 6: the two passwords in its list of
  keys.
- Vercel jvb-studio, Production: `OPENSEARCH_URL`,
  `OPENSEARCH_SEARCH_USER`, `OPENSEARCH_SEARCH_PASSWORD`,
  `OPENSEARCH_INDEX_USER`, `OPENSEARCH_INDEX_PASSWORD`. Left unset,
  everything works as before.

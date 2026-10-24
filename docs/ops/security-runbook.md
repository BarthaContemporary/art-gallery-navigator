# Security runbook: sign-in server, gateway and keys

Written 24 October 2026 with the fixes for security-review finding F1 and the
two server checks the review asked for (the `/pg/` gateway route and the
service-role key). It is for a careful person with SSH access to the gallery
server; no programming is needed. Every step says what to do, how to see that
it worked, and how to undo it.

## What this does, in short

The sign-in server (GoTrue, part of the self-hosted Supabase on the Vultr
server) answers anyone on the internet, not only the studio's sign-in page.
Until now it counted nothing: someone who knew a staff email address could ask
for a password-reset code and guess it, or guess passwords, as fast as they
liked, and a reset code stayed valid for 24 hours. After this runbook:

- the sign-in server limits how often any one internet address may try a
  code, a password or a reset (steps 2 to 4);
- emailed codes are 10 digits instead of 6 and expire after 30 minutes
  instead of 24 hours (step 2);
- nobody on the internet can make the server email a code at all; the
  gallery never used that (step 3);
- the gateway's "run any SQL" route, `/pg/`, is confirmed closed (step 5);
- every API key is replaced, so the service-role key once pasted into a chat
  stops working (step 6);
- the sign-in server itself runs the Cloudflare check that guards the
  sign-in form, so the check also stops anyone who skips the form (step 7);
- the Google Maps key that ships in the web pages only works from the
  gallery's own sites (step 8).

| Step | What | Interruption | Time |
|---|---|---|---|
| 1 | Back up | none | 5 min |
| 2 | New sign-in server settings | API about 10 s | 10 min |
| 3 | Edge server: name the caller, close code emails | none | 10 min |
| 4 | Prove the limits work | none | 5 min |
| 5 | Close `/pg/` on the gateway | API a few seconds, only if it was open | 10 min |
| 6 | Replace the keys | studio, capture and website forms about 5 min; everyone signs in again | 30 min |
| 7 | Cloudflare check at the sign-in server | none if done in order | 20 min |
| 8 | Google Maps keys | none if done in order | 20 min |

Do steps 1 to 5 in one sitting. Steps 6, 7 and 8 can each be done on another
day; repeat step 1 first each time, so the backup is fresh.

## Before you start

You need:

- SSH access to the server as root: `ssh root@104.238.184.145` (add
  `-p <port>` if you normally use another port).
- Vercel: team "Joost van den Bergh Project", projects jvb-studio, jvb-web and
  capture.
- Cloudflare, account Joostvandenberghproject@gmail.com (Turnstile).
- Google Cloud console, the project that holds the Maps key.
- The password manager. New keys go there first.
- A computer with this repository, up to date with `main` after the security
  changes were merged (`git pull`). Steps 2 and 5 copy files from it.
- For steps 7 and 8: the studio and capture app deployed on Vercel from that
  same `main` (the sign-in pages and the capture geocoding changed with it).

How to read the commands: grey boxes are typed into the server after `ssh`,
unless they say "on your computer". Copy each box whole. Text in `<angle
brackets>` is yours to fill in. Lines starting with `#` are notes and do
nothing.

**Every time you open a new SSH session**, run this first. It moves to the
right folder and sets two names used below; nothing secret is printed.

```sh
cd /opt/jvb/infra/compose
API=$(grep '^API_EXTERNAL_URL=' .env | cut -d= -f2-)
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
echo "API is $API"
```

Check: it prints `API is https://api.104-238-184-145.sslip.io` (or whatever
API address the apps use). If it prints `API is ` with nothing after it, stop:
the server's settings are not where this runbook expects them.

## Step 1. Back up

```sh
B=/root/security-backup-$(date +%Y%m%d-%H%M)
mkdir -p "$B" && chmod 700 "$B"
cp -a docker-compose.yml .env volumes/api/kong.yml /etc/caddy/Caddyfile "$B"/
ls -la "$B"
echo "Backup folder: $B"
/opt/jvb/infra/scripts/backup.sh db
```

Write down the backup folder's name. The undo commands below use `$B`; in a
new SSH session set it again first: `B=/root/security-backup-<what you wrote down>`.

**Check:** the listing shows `.env`, `Caddyfile`, `docker-compose.yml` and
`kong.yml`, and the database backup ends with `db backup complete`.

**Undo:** nothing to undo. The folder holds secrets and only root can read
it; delete it a week after the last step (`rm -r "$B"`).

## Step 2. New sign-in server settings

What changes: the sign-in server's block in `docker-compose.yml` gains the
limits, the 10-digit 30-minute codes and the Cloudflare check (still off).
Appendix A shows the exact lines and what each does.

1. On your computer, in the repository folder:

   ```sh
   scp infra/compose/docker-compose.yml root@104.238.184.145:/opt/jvb/infra/compose/docker-compose.yml.new
   ```

2. On the server, compare it with the live file:

   ```sh
   diff docker-compose.yml docker-compose.yml.new
   ```

   Lines starting with `>` are only in the new file, lines starting with `<`
   only in the live one.

   - If the `>` lines are just the new block (Appendix A) and there are no
     `<` lines, use the new file:

     ```sh
     mv docker-compose.yml.new docker-compose.yml
     ```

   - Otherwise (the live file differs elsewhere too, for example a pinned
     dashboard image), keep the live file and add the block by hand:
     `nano docker-compose.yml`, press Ctrl+W and search for
     `REUSE_INTERVAL`, press End, press Enter, and paste Appendix A. Every
     pasted line must start with exactly six spaces, like the line above it.
     Save with Ctrl+O, Enter, then leave with Ctrl+X. Then
     `rm docker-compose.yml.new`.

3. Add the two captcha settings (still off) to `.env`:

   ```sh
   grep -q '^AUTH_CAPTCHA_ENABLED=' .env || printf '\n# GoTrue checks Turnstile itself (docs/ops/security-runbook.md step 7)\nAUTH_CAPTCHA_ENABLED=false\nAUTH_CAPTCHA_SECRET=\n' >> .env
   ```

4. Check the file and show the new settings (none of these lines is secret):

   ```sh
   docker compose config --quiet && echo "compose file OK"
   docker compose config | grep -E 'GOTRUE_(RATE_LIMIT|MAILER_OTP|SECURITY_CAPTCHA_(ENABLED|PROVIDER))'
   ```

   Expect `compose file OK` and these nine lines (in any order):

   ```
   GOTRUE_MAILER_OTP_EXP: "1800"
   GOTRUE_MAILER_OTP_LENGTH: "10"
   GOTRUE_RATE_LIMIT_EMAIL_SENT: "10"
   GOTRUE_RATE_LIMIT_HEADER: X-JVB-Client-IP
   GOTRUE_RATE_LIMIT_OTP: "5"
   GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "60"
   GOTRUE_RATE_LIMIT_VERIFY: "10"
   GOTRUE_SECURITY_CAPTCHA_ENABLED: "false"
   GOTRUE_SECURITY_CAPTCHA_PROVIDER: turnstile
   ```

5. Restart the sign-in server, then the gateway:

   ```sh
   docker compose up -d auth
   docker compose restart kong
   ```

   The gateway (Kong) remembers the sign-in server's internal address for a
   while, and a restarted sign-in server can come back on a new one;
   restarting the gateway makes it look again. The API is unavailable for
   about ten seconds.

**Check:**

```sh
sleep 20; docker compose ps auth kong
curl -s "$API/auth/v1/health" -H "apikey: $ANON"; echo
```

`auth` shows `Up` and `(healthy)`, `kong` shows `Up`, and the second line is a
short text containing `GoTrue`. Then sign in to the studio and to the capture
app, once with a password and once with a passkey.

**Undo:**

```sh
cp -a "$B/docker-compose.yml" docker-compose.yml
docker compose up -d auth && docker compose restart kong
```

## Step 3. Edge server: name the caller, close the code emails

The limits from step 2 only count once the edge server (Caddy, which receives
every request from the internet) tells the sign-in server which address is
calling. This step adds that, and turns away requests asking the sign-in
server to email a sign-in or reset code. The gallery never sends those: staff
are created and re-invited from the studio's Admin page, which makes the link
itself. Appendix B shows the lines.

1. Find the API site's proxy line:

   ```sh
   grep -n "127.0.0.1:8000" /etc/caddy/Caddyfile
   ```

   Expect exactly one line, such as `52:	reverse_proxy 127.0.0.1:8000`. If
   there is none, or more than one, stop and ask for help.

2. `nano /etc/caddy/Caddyfile`, press Ctrl+W, search for `127.0.0.1:8000`,
   and replace that one line with the lines in Appendix B. Tabs or spaces
   both work. If the line ends in `{` (the live file already has settings
   inside it), keep it: put the `header_up` line as the first line inside its
   braces, and the `@auth_code_email` and `respond` lines just above it. Save
   with Ctrl+O, Enter, Ctrl+X.

3. Check the file, then load it:

   ```sh
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy && echo "caddy reloaded"
   ```

   Expect `Valid configuration` and `caddy reloaded`. If validation prints an
   error, nothing was loaded and the old settings are still running: fix
   what it names, or undo.

**Check:**

```sh
curl -s -o /dev/null -w 'health: %{http_code}\n' "$API/auth/v1/health" -H "apikey: $ANON"
curl -s -o /dev/null -w 'reset email: %{http_code}\n' -X POST "$API/auth/v1/recover" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"email":"nobody@example.invalid"}'
```

Expect `health: 200` and `reset email: 403`. Sign in to the studio once more.

**Undo:**

```sh
cp -a "$B/Caddyfile" /etc/caddy/Caddyfile && systemctl reload caddy
```

## Step 4. Prove the limits work

Run these on the server. That way only the server's own address is held back
for a few minutes, never the gallery's office.

Bad codes:

```sh
for i in $(seq 1 45); do curl -s -o /dev/null -w '%{http_code} ' -X POST "$API/auth/v1/verify" -H 'Content-Type: application/json' -d '{"type":"recovery","email":"limit-test@example.invalid","token":"0000000000"}'; done; echo
```

Bad passwords:

```sh
for i in $(seq 1 45); do curl -s -o /dev/null -w '%{http_code} ' -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"email":"limit-test@example.invalid","password":"not-the-password"}'; done; echo
```

**Check:** each prints a row of numbers: first `403` (wrong code) or `400`
(wrong password), then `429` (too many attempts). Any other number in the
400s before the `429`s is fine too: it only means "wrong". The sign-in server
lets a first burst of about 30 through, so expect roughly 30 of the first
kind and 15 of `429`. The count empties again within about five minutes.

If a row never shows `429`, the limits are not counting. Check, in order:
step 2's list showed `GOTRUE_RATE_LIMIT_HEADER: X-JVB-Client-IP`; the
Caddyfile has `header_up X-JVB-Client-IP {remote_host}` spelt the same way;
`systemctl reload caddy` ran after the edit.

One more check: `ip -6 addr show scope global` should print nothing. The
limits count per internet address, and one IPv6 user holds millions of
addresses; this server was created with IPv6 off. If it prints an address,
tell whoever looks after the code.

**Undo:** nothing to undo.

## Step 5. Close the database's SQL route on the gateway (`/pg/`)

Background: postgres-meta, a helper for the database dashboard, runs any SQL
as the database's master user. It must never be reachable from the internet,
even behind the service-role key, or one leaked key hands over the whole
database. The repository's gateway file does not route it, but earlier notes
say the live server did, and that migrations were applied through it.

1. Is it open?

   ```sh
   curl -s -o /dev/null -w '/pg/: %{http_code}\n' "$API/pg/query"
   grep -n "meta" volumes/api/kong.yml
   ```

   - `/pg/: 404`, and every line the second command prints is a comment
     (after its number and some spaces it starts with `##`): it is closed.
     Go to 5.4.
   - Anything else (`401`, `200`, …), or lines such as
     `url: http://meta:8080/` or `- /pg/`: it is open. Continue.

2. Replace the live gateway file with the repository's. On your computer:

   ```sh
   scp infra/compose/volumes/api/kong.yml root@104.238.184.145:/opt/jvb/infra/compose/volumes/api/kong.yml.new
   ```

   On the server:

   ```sh
   diff volumes/api/kong.yml volumes/api/kong.yml.new
   ```

   If the `<` lines are the meta service (lines naming `meta`, `/pg/`, and
   the `key-auth` and `acl` settings under it) and comments, and the `>`
   lines are all comments, use the new file:

   ```sh
   mv volumes/api/kong.yml.new volumes/api/kong.yml
   ```

   If other `<` lines appear (something the repository does not have), keep
   the live file and delete only the meta service by hand: `nano
   volumes/api/kong.yml`, find `- name: meta` (Ctrl+W), and delete from that
   line down to just before the next line that starts with two spaces and
   `- name:` (the next service), or to the end of the file if none follows.
   Ctrl+K deletes the line the cursor is on. Save, and
   `rm volumes/api/kong.yml.new`.

3. Restart the gateway (it reads this file only when it starts; the API is
   unavailable for a few seconds):

   ```sh
   docker compose restart kong
   ```

**Check:**

```sh
sleep 10
curl -s -o /dev/null -w '/pg/: %{http_code}\n' "$API/pg/query"
curl -s -o /dev/null -w 'data API: %{http_code}\n' "$API/rest/v1/" -H "apikey: $ANON"
```

Expect `/pg/: 404` and `data API: 200`. Open the studio; the inventory loads.

**Undo** (this reopens `/pg/`): `cp -a "$B/kong.yml" volumes/api/kong.yml && docker compose restart kong`

### 5.4 Migrations from now on: through an SSH tunnel

As `supabase/README.md` describes, never through `/pg/query`. On your
computer, in a first terminal window (it prints nothing and looks frozen;
that is right, leave it open):

```sh
ssh -N -L 54322:127.0.0.1:5432 root@104.238.184.145
```

In a second window, in the repository folder, for each migration file:

```sh
psql "host=127.0.0.1 port=54322 user=supabase_admin dbname=postgres" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

It asks for the password: `POSTGRES_PASSWORD` from the server's `.env` (also
in the password manager). The user is `supabase_admin`, the database user the
old `/pg/query` route ran as, so new migrations own their tables and
functions the same way the earlier ones do. Every migration ends with
`notify pgrst, 'reload schema';`. If one does not, run
`psql "host=127.0.0.1 port=54322 user=supabase_admin dbname=postgres" -c "notify pgrst, 'reload schema';"`
afterwards, or the studio and website will not see the new tables. Close the
first window when done.

No `psql` on your computer? Run it on the server instead: on your computer
`scp supabase/migrations/<file>.sql root@104.238.184.145:/tmp/`, then on the
server `docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < /tmp/<file>.sql`.

## Step 6. Replace the keys (rotate JWT_SECRET)

Why: every API key is a signed note, and every signature comes from one
secret, `JWT_SECRET`. The service-role key (full access past every row rule)
was once pasted into a chat. A newly made service-role key signed with the
same secret does **not** cancel the old one: both stay valid. Only a new
`JWT_SECRET` cancels every old key at once. So every place that holds a key
gets the new one in the same sitting.

| Key | Where it is used |
|---|---|
| `JWT_SECRET` | the server's `.env` only |
| anon key (public) | server `.env` (`ANON_KEY`); Vercel jvb-studio, jvb-web, capture: `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service-role key | server `.env` (`SERVICE_ROLE_KEY`; the gateway, storage, image worker and dashboard read it from there); Vercel jvb-studio, jvb-web, capture: `SUPABASE_SERVICE_ROLE_KEY` |
| copies | the password manager's copy of `.env`; any `apps/*/.env.local` or `tooling/migration/.env` on a developer's computer; `infra/scripts/.bootstrap-state/secrets.env` if the bootstrap script was ever run from a computer |

Expect about five minutes in which the studio, the capture app and the
website's forms (enquiries, appointments, newsletter) fail, and afterwards
everyone signs in again. Passwords and passkeys stay as they are. Pick a
quiet time.

**6.1 Make the new secret and keys** (on the server; nothing changes yet).
Keep this SSH window open until step 6 is finished: the new values exist only
in it until 6.4.

```sh
OLD_SERVICE=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
NEW_JWT_SECRET=$(openssl rand -hex 32)
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
mint() {
  now=$(date +%s); exp=$((now + 10*365*24*3600))
  h=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
  p=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$now" "$exp" | b64url)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$NEW_JWT_SECRET" -binary | b64url)
  printf '%s.%s.%s\n' "$h" "$p" "$s"
}
NEW_ANON=$(mint anon)
NEW_SERVICE=$(mint service_role)
echo "anon: ${#NEW_ANON} characters, service: ${#NEW_SERVICE} characters, secret: ${#NEW_JWT_SECRET}"
```

Check: it prints about `anon: 169 characters, service: 180 characters, secret: 64`.
The keys are made the same way as the bootstrap script makes them (valid ten
years).

**6.2 Save them.** Show each one, copy it into a new password-manager entry
("JVB Supabase keys <date>"), then clear the screen:

```sh
echo "$NEW_ANON"
echo "$NEW_SERVICE"
echo "$NEW_JWT_SECRET"
clear
```

**6.3 Vercel: enter the new keys, do not redeploy yet.** In each of
jvb-studio, jvb-web and capture: Settings → Environment Variables →
`NEXT_PUBLIC_SUPABASE_ANON_KEY` → Edit → the new anon key; then
`SUPABASE_SERVICE_ROLE_KEY` → Edit → the new service-role key. A variable can
exist separately for Production, Preview and Development: change every copy.
A project without one of these variables does not need it. The running sites
keep their old keys until the redeploy in 6.5, so nothing changes yet.

**6.4 Switch the server** (the API goes down for about a minute):

```sh
sed -i -e "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" -e "s|^ANON_KEY=.*|ANON_KEY=$NEW_ANON|" -e "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$NEW_SERVICE|" .env
grep -c -E "^(JWT_SECRET=$NEW_JWT_SECRET|ANON_KEY=$NEW_ANON|SERVICE_ROLE_KEY=$NEW_SERVICE)$" .env
docker compose up -d
```

The middle line prints `3`. `up -d` restarts every service that reads a key:
database, gateway, sign-in server, data API, storage, dashboard, image worker.

**6.5 Vercel: redeploy** jvb-studio, jvb-web and capture now: Deployments →
the latest Production deployment → ⋯ → Redeploy, with "Use existing Build
Cache" unticked (the public key is built into the pages). Wait for "Ready".

**6.6 Sign everyone out.** Sessions started before the switch could otherwise
be renewed:

```sh
docker compose exec db psql -U supabase_admin -d postgres -c 'delete from auth.sessions;'
docker compose exec db psql -U supabase_admin -d postgres -c 'select count(*) from auth.refresh_tokens where not revoked;'
```

Expect `DELETE` with a number, then a count of `0`. If the count is not 0:
`docker compose exec db psql -U supabase_admin -d postgres -c 'delete from auth.refresh_tokens;'`

(The database also kept a copy of the old secret in a setting called
`app.settings.jwt_secret` when it was first started. Nothing in this system
reads it, and the old secret is worthless once replaced: leave it.)

**Check:**

```sh
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
curl -s -o /dev/null -w 'new anon key: %{http_code}\n' "$API/rest/v1/" -H "apikey: $ANON"
curl -s -o /dev/null -w 'old service key: %{http_code}\n' "$API/rest/v1/" -H "apikey: $OLD_SERVICE"
curl -s -o /dev/null -w 'old service key, storage: %{http_code}\n' "$API/storage/v1/bucket" -H "Authorization: Bearer $OLD_SERVICE"
curl -s -o /dev/null -w 'new service key, storage: %{http_code}\n' "$API/storage/v1/bucket" -H "Authorization: Bearer $NEW_SERVICE"
docker compose ps
docker compose logs --tail=20 image-worker
```

Expect `new anon key: 200`, `old service key: 401`, the old key at storage
anything but `200` (usually `400` or `403`), the new key at storage `200`;
every service `Up` (and `healthy` where shown); no `JWT` or `signature`
errors in the image worker's last lines. Then, in a browser: sign in to the
studio (password, then passkey), open the inventory (thumbnails show) and
one record; sign in to the capture app; send yourself a test enquiry from the
website with your own email address and see it arrive as usual (delete the
test contact in the studio afterwards). Tell staff they need to sign in again.

Finally replace the copies listed in the table above (password manager,
developers' `.env.local` files, the bootstrap state file).

**Undo** (this brings back the old keys, the leaked one included):

```sh
cp -a "$B/.env" .env && docker compose up -d
```

then put the old two values back in Vercel (all three projects, every
environment; they are in the password manager's old `.env` copy) and redeploy
the three projects.

## Step 7. Cloudflare check at the sign-in server

Today the studio's server checks the Cloudflare (Turnstile) box on its
sign-in form, but someone calling the sign-in server directly never meets it.
From this step the sign-in server checks the box itself, for the studio and
for the capture app, which gets the box for the first time. A Cloudflare
token can be checked only once, so the apps stop checking it themselves when
`AUTH_SERVER_CAPTCHA` is set and pass it to the sign-in server instead. Do
the parts in this order: between 7.4 and 7.5 neither side checks, so do 7.5
straight after 7.4; done the other way round, password sign-in would fail
until the apps are redeployed.

**7.1 Cloudflare:** Turnstile → the widget whose site key starts
`0x4AAAAAAD` → Hostname management. Add the capture app's address (for
example `capture.joostvandenbergh.com`: the address staff open it at). Keep
the others.

**7.2 Vercel capture:** Settings → Environment Variables → add
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the same site key the jvb-studio project
has, for Production and Preview.

**7.3 Vercel jvb-studio and capture:** add `AUTH_SERVER_CAPTCHA` = `1`, for
Production and Preview.

**7.4 Redeploy** jvb-studio and capture (Deployments → latest Production → ⋯
→ Redeploy, "Use existing Build Cache" unticked: the site key is built into
the page). Wait for "Ready". Check: the capture app's sign-in page now
shows the Cloudflare box under the password field; the studio's looks as
before.

**7.5 The sign-in server** (right away). Put the widget's **secret** key
(Cloudflare → the same widget → Settings; it is also the value of
`TURNSTILE_SECRET_KEY` in jvb-studio) into `.env`:

```sh
nano .env
```

Change `AUTH_CAPTCHA_ENABLED=false` to `AUTH_CAPTCHA_ENABLED=true`, and put
the secret after `AUTH_CAPTCHA_SECRET=` (no spaces, no quotes). Save with
Ctrl+O, Enter, Ctrl+X. Then:

```sh
docker compose up -d auth && docker compose restart kong
```

**Check:**

```sh
sleep 20; docker compose ps auth
curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"email":"captcha-test@example.invalid","password":"x"}'; echo
```

`auth` is `Up (healthy)`. The reply mentions `captcha` (for example
`captcha verification process failed`) instead of `Invalid login
credentials`. (If it says `Request rate limit reached`, step 4's count has
not emptied yet; wait five minutes and try again.) Then sign in with a
password to the studio and to the capture app, ticking the box when it asks;
passkey sign-in works as before. If `auth` keeps restarting, the secret is
missing or mistyped: `docker compose logs --tail=30 auth` says so; undo.

Password sign-in on a Vercel preview address works only if that address is
in the widget's hostname list; passkeys and the production addresses are
unaffected.

**Undo:** first set `AUTH_CAPTCHA_ENABLED=false` in `.env` and run
`docker compose up -d auth && docker compose restart kong` (sign-in works
again at once). Then remove `AUTH_SERVER_CAPTCHA` from both Vercel projects
and redeploy them, soon: until then neither side checks the box.

## Step 8. Google Maps keys

The Maps key is built into the studio's and capture app's web pages, where
anyone can read it, so it must only work from the gallery's own sites. The
capture app also uses it from its server to suggest where a piece was bought,
and Google refuses a site-restricted key there. So that part gets its own
key, limited to the two services it uses and to a daily number of requests.
Do the parts in this order, or the purchase-place suggestion stops between
them.

**8.1 Server key.** Google Cloud console → APIs & Services → Credentials →
Create credentials → API key. Name it "capture server geocoding".
Application restrictions: None (Vercel's servers have no fixed address). API
restrictions: Restrict key → **Geocoding API** and **Places API** (the older
one; the capture app's nearby search uses it, and it is already enabled if
purchase-place suggestions work today). Save.

**8.2 Daily caps.** APIs & Services → Geocoding API → Quotas & system limits
→ requests per day → Edit → 500. The same for Places API. (The capture app
makes at most a few per captured piece; a cap stops a leaked key from
running up a bill.)

**8.3 Vercel capture:** add `GOOGLE_MAPS_SERVER_KEY` = the new key, for
Production and Preview. Redeploy capture. Check: capture a test piece with
location on; the purchase place is suggested as before.

**8.4 Browser key.** Credentials → the key whose value is
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel. Application restrictions:
Websites → add `https://studio.joostvandenbergh.com/*` and the capture app's
address, for example `https://capture.joostvandenbergh.com/*` (add a
preview address only if you test address lookup on previews). API
restrictions: Restrict key → **Maps JavaScript API**, **Places API (New)**,
**Maps Static API**. Save; it takes up to five minutes to apply.

**Check:** in the studio, a contact's address field suggests addresses and
shows the small map; in the capture app, the address lookup works. From the
server, the browser key is now refused outside the sites:

```sh
curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=<the browser key>" | grep -E '"status"'
```

Expect `"status" : "REQUEST_DENIED"`.

**Undo:** set the browser key's restrictions back to None, and delete
`GOOGLE_MAPS_SERVER_KEY` from Vercel capture and redeploy (the capture app
then uses the browser key on its server again, as before).

## Afterwards

- Ask whoever keeps the project notes to record the date, and to replace the
  `/pg/query` instructions in `PROJECT_STATUS.md` and `CLAUDE.md` with the
  SSH tunnel of step 5.4, and close the "rotate the service_role key" item.
- Delete the backup folder from step 1 a week after the last step.

## Why there is no fail2ban jail for failed sign-ins

fail2ban blocks an address from the whole server. The studio and capture app
sign in from Vercel's servers, so a block would cut the studio off for every
user that Vercel address serves, and an outsider could trigger one on
purpose by failing sign-ins through the studio's own page. The limits from
step 2 slow guessing per address without that risk. The file drive's jail
was retired for a similar reason
(`infra/security/fail2ban/jail.d/caddy-webdav.conf`); the dashboard's jail
(`caddy-studio`) is unchanged.

## Appendix A: the sign-in server block

These lines sit in `docker-compose.yml` under `auth:` → `environment:`,
straight after `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: "86400"`. Each
starts with six spaces.

```yaml
      # --- Guessing limits (security review F1; docs/ops/security-runbook.md)
      # GoTrue counts attempts per client only when it is told which request
      # header carries the client's address; without it nothing is counted.
      # Caddy, the only way in from the internet, overwrites X-JVB-Client-IP
      # with the connecting address on every request (api block in
      # ./Caddyfile), so a client cannot pick its own count. Not X-Real-IP:
      # Kong replaces that with its own Docker-side peer, which would put the
      # whole internet in one count. Requests from inside Docker carry no
      # header and are not counted.
      GOTRUE_RATE_LIMIT_HEADER: X-JVB-Client-IP
      # Per client address, per 5 minutes, after a first burst of up to 30
      # that GoTrue lets through. verify (default 30) = emailed codes and
      # links. token (default 150) = password sign-ins AND session refreshes;
      # the studio and capture servers sign in and refresh for everyone from a
      # few shared Vercel addresses, and a refused refresh signs that user
      # out, so this stays well above their need. otp (default 30) = requests
      # for code emails, and password changes.
      GOTRUE_RATE_LIMIT_VERIFY: "10"
      GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "60"
      GOTRUE_RATE_LIMIT_OTP: "5"
      # Auth emails per hour for the whole server (default 30). Nothing the
      # gallery uses has GoTrue send one (Admin's re-invite mints its link
      # with the service role and sends it through Resend), so this only caps
      # abuse.
      GOTRUE_RATE_LIMIT_EMAIL_SENT: "10"
      # Emailed codes: 10 digits, the most GoTrue allows (default 6), valid
      # 30 minutes (default 24 hours). The expiry covers every emailed link
      # too, Admin's re-invite ("set your password") link included.
      GOTRUE_MAILER_OTP_LENGTH: "10"
      GOTRUE_MAILER_OTP_EXP: "1800"
      # Cloudflare Turnstile checked by GoTrue itself on password sign-in, so
      # the check guards the endpoint an attacker can call directly, not only
      # the studio's form. Off until the owner turns it on in .env
      # (AUTH_CAPTCHA_ENABLED + AUTH_CAPTCHA_SECRET) together with
      # AUTH_SERVER_CAPTCHA=1 for the studio and capture apps on Vercel:
      # runbook step 7. Turned on without a secret, password sign-in stops
      # working.
      GOTRUE_SECURITY_CAPTCHA_ENABLED: ${AUTH_CAPTCHA_ENABLED:-false}
      GOTRUE_SECURITY_CAPTCHA_PROVIDER: turnstile
      GOTRUE_SECURITY_CAPTCHA_SECRET: ${AUTH_CAPTCHA_SECRET:-}
```

| Setting | Before | Now | What it means |
|---|---|---|---|
| Rate-limit header | none (nothing counted) | `X-JVB-Client-IP` | attempts are counted per internet address |
| Code and link checks | unlimited | 10 per 5 min per address, after a burst of about 30 | with 10-digit codes, one address would need thousands of years to guess one |
| Password sign-ins and session refreshes | unlimited | 60 per 5 min per address, after a burst of about 30 | password guessing slowed; staff unaffected |
| Code-email requests, password changes | unlimited | 5 per 5 min per address | |
| Auth emails, whole server | 30 an hour | 10 an hour | caps abuse; the gallery sends none this way |
| Emailed code | 6 digits, 24 hours | 10 digits, 30 minutes | Admin's re-invite link also expires after 30 minutes |
| Cloudflare check at the sign-in server | not available | available, off until step 7 | |

## Appendix B: the edge server's API block

The line `reverse_proxy 127.0.0.1:8000` in the API site of
`/etc/caddy/Caddyfile` is replaced with:

```
	# GoTrue's endpoints that email a sign-in or recovery code: closed from
	# the internet (security review F1; docs/ops/security-runbook.md step 3).
	@auth_code_email path /auth/v1/recover* /auth/v1/otp* /auth/v1/magiclink* /auth/v1/resend* /auth/v1/signup*
	respond @auth_code_email "Not available" 403

	reverse_proxy 127.0.0.1:8000 {
		# The address GoTrue counts sign-in attempts against; set here on
		# every request, replacing anything the client sent.
		header_up X-JVB-Client-IP {remote_host}
	}
```

Caddy matches these paths regardless of capital letters and doubled
slashes, so variants of them are closed too. The database dashboard reaches
the sign-in server inside the server, not through Caddy, so its own "send
reset email" buttons keep working.

## Appendix C: what changed in the repository

- `infra/compose/docker-compose.yml`: the block in Appendix A.
- `infra/compose/.env.example`: `AUTH_CAPTCHA_ENABLED`, `AUTH_CAPTCHA_SECRET`.
- `infra/compose/Caddyfile`: the block in Appendix B.
- `infra/compose/volumes/api/kong.yml`: comments only (the `/pg/` history,
  and why GoTrue is not pointed at `X-Real-IP`).
- Studio and capture sign-in pages (`apps/*/src/app/login/`): with
  `AUTH_SERVER_CAPTCHA` set they pass the Cloudflare token to the sign-in
  server instead of checking it themselves; unset, they behave as before.
  The page's error line now shows one of a few fixed messages chosen by a
  short code in the address (`?error=credentials`), never text taken from
  the address. The capture app shows the Cloudflare box when the setting is
  on.
- `apps/capture/src/lib/geocode.ts`: uses `GOOGLE_MAPS_SERVER_KEY` when set.

New settings: `AUTH_CAPTCHA_ENABLED` and `AUTH_CAPTCHA_SECRET` (server
`.env`), `AUTH_SERVER_CAPTCHA` (Vercel jvb-studio and capture),
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Vercel capture, new there),
`GOOGLE_MAPS_SERVER_KEY` (Vercel capture). Left unset, everything works as
before.

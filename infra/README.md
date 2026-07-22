# infra/ — ops runbook

Self-hosted Supabase on a single Vultr VPS (London) for the gallery system.
Everything the VPS runs lives here; the apps themselves run on Vercel
(BUILD_PLAN §2). Keep this document current — it is the disaster-recovery
manual.

```
infra/
  compose/          docker-compose.yml, .env.example, Caddyfile, kong/db init
  image-worker/     Node + sharp derivative worker (built by compose)
  scripts/          provision.sh, backup.sh, restore-drill.sh
```

## 1. Provisioning order (fresh VPS)

1. **Create the instance**: Vultr High Frequency, 4 vCPU / 8 GB / 256 GB NVMe,
   London, Ubuntu 24.04. Add your SSH key at creation.
2. **Create Object Storage** (London / `lhr1`) and three buckets:
   `jvb-storage` (storage-api backend), `jvb-storage-replica` (weekly sync
   target), `jvb-backups` (pg dumps). Note the access key/secret.
3. **Run the provision script** as root:
   ```sh
   scp infra/scripts/provision.sh root@<ip>:
   ssh root@<ip> 'SSH_PORT=2222 bash provision.sh'
   ```
   It creates the `deploy` user, hardens SSH (custom port, keys only, no
   root), enables UFW (80/443/SSH only), fail2ban, unattended-upgrades,
   installs Docker + compose plugin + Caddy, and sets `vm.overcommit_memory=1`.
   **Verify `ssh -p 2222 deploy@<ip>` works before closing the root session.**
4. **DNS** (see §2) — must resolve before Caddy can obtain certificates.
5. **Clone + configure** as `deploy`:
   ```sh
   sudo install -d -o deploy -g deploy /opt/jvb
   git clone <repo> /opt/jvb          # read-only deploy key
   cd /opt/jvb/infra/compose
   cp .env.example .env && chmod 600 .env    # fill in EVERY CHANGE_ME
   ```
   Generate secrets: `openssl rand -base64 48` for `JWT_SECRET` (40+ chars),
   then derive `ANON_KEY` / `SERVICE_ROLE_KEY` from it with the Supabase CLI
   or the self-hosting JWT generator
   (<https://supabase.com/docs/guides/self-hosting#api-keys>).
6. **Caddy**: edit `Caddyfile` (real domains, `caddy hash-password` output in
   the `basic_auth` block), then:
   ```sh
   sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
   ```
7. **Bring the stack up** (§3), **apply migrations** (§4), then configure
   `rclone` and cron for backups (§5) and monitoring (§6).
8. **Prove it**: run `scripts/restore-drill.sh` once the first nightly backup
   exists. Phase 0 is not done until the drill passes.

## 2. DNS records

| Record | Type | Value | Purpose |
|---|---|---|---|
| `api.<domain>` | A | VPS IP | Supabase gateway (Caddy → Kong :8000) |
| `studio.<domain>` | A | VPS IP | Supabase dashboard (Caddy → :3000, basic-auth, break-glass only) |
| Resend DKIM/SPF/MX | per Resend | per Resend | auth + offer/newsletter email |

The Next.js apps (`studio` back-office, public site) are Vercel domains and
do not point at the VPS. Public-site images are served from Sanity's CDN —
no public traffic ever reaches this box except API calls.

## 3. Bringing the stack up / down

```sh
cd /opt/jvb/infra/compose
docker compose up -d          # first run builds ../image-worker
docker compose ps             # all services healthy?
docker compose logs -f image-worker
```

Smoke test from your machine:

```sh
curl -H "apikey: $ANON_KEY" https://api.<domain>/rest/v1/   # 200 JSON
curl https://api.<domain>/auth/v1/health                     # GoTrue health
```

Down: `docker compose down` (data survives in the `db-data` volume and in
Object Storage). Never `down -v` on production — that deletes the database.

## 4. Applying migrations

Postgres is bound to `127.0.0.1:5432` on the VPS only. Work over an SSH
tunnel:

```sh
ssh -p 2222 -N -L 54322:127.0.0.1:5432 deploy@<vps>
# then, from the repo root on your machine:
supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres"
# or ad-hoc admin:
psql "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres"
```

Migrations live in `supabase/migrations/` and are the only supported way to
change schema. They also create the storage buckets (`piece-originals`,
`piece-derivatives`, `piece-documents` — all private) and the
`new_piece_image` NOTIFY trigger the image-worker listens on.

## 5. Backups & restore

Configure the rclone remote once (as `deploy`): `rclone config` → s3 /
provider Other / endpoint `https://lhr1.vultrobjects.com` + the Object
Storage keys. Name it `vultr` (scripts default to that).

| What | Script | Schedule (cron, §comments in script) |
|---|---|---|
| Postgres dump (`pg_dump -Fc`) → `jvb-backups/backups/postgres/` | `backup.sh db` | nightly 02:30 UTC |
| Retention: newest 30 + first-of-month for 12 months | (built into `backup.sh db`) | — |
| Storage bucket → replica bucket | `backup.sh storage-sync` | weekly Sun 03:30 UTC |
| Restore drill (throwaway container + sanity counts) | `restore-drill.sh` | quarterly, and after any major change |

`backup.sh db` pings `HEALTHCHECKS_URL` (healthchecks.io) on success — a
missed ping alerts us that backups silently stopped. Set the URLs in the
cron environment or at the top of the script.

**Restore to production** (worst case, §8 covers full DR):

```sh
cd /opt/jvb/infra/compose
docker compose stop image-worker rest storage auth   # stop writers
rclone copyto vultr:jvb-backups/backups/postgres/<dump> /tmp/restore.dump
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --no-owner /tmp/restore.dump
docker compose up -d
```

## 6. Monitoring

- **healthchecks.io** (free tier): dead-man switches for the nightly backup
  and weekly storage sync — configured in §5.
- **HTTP uptime**: either Better Stack (hosted, simplest) probing
  `https://api.<domain>/auth/v1/health`, or self-host Uptime Kuma by
  appending this optional block to `docker-compose.yml`:

  ```yaml
  # Optional — Uptime Kuma at 127.0.0.1:3001 (add a Caddy site or SSH-tunnel to it)
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    networks: [supabase]
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - uptime-kuma-data:/app/data
  # ...and add `uptime-kuma-data:` under `volumes:`
  ```

  (A hosted monitor is preferred: a monitor on the same box misses the box
  itself dying.)
- **Disk**: watch `db-data` volume growth; originals/derivatives are in
  Object Storage so the NVMe mostly holds Postgres + logs.

## 6b. Rebuild the image-worker (e.g. HEIC support)

The worker runs from source in the image; a code/dependency change (like the
`heic-convert` HEIC fallback) needs a rebuild + restart on the VPS:

```
cd /opt/jvb && git pull
cd infra/compose
docker compose build image-worker
docker compose up -d image-worker
docker compose logs -f image-worker          # watch it come up clean
```

Then re-queue any rows that failed on the old worker (the derivative job is
idempotent — it overwrites the display master):

```
# reset the HEIC failures back to pending; the worker picks them up on its next poll
docker compose exec -T db psql -U postgres -d postgres -c \
  "update piece_images set processing_status='pending', processing_error=null \
   where processing_status='error' and legacy_container_filename ilike '%.heic';"
```

Note: `heic-convert` is a pure-JS (WASM) decoder, so no apt packages or a
libvips rebuild are required — a plain `docker compose build` is enough.

## 6c. WebDAV shared drive (encrypted at rest)

The gallery's self-hosted "Dropbox": a WebDAV server on the VPS, mounted in
Finder (Macs) and the Files app (iPhone/iPad). Security layers: **TLS** in
transit (Caddy), **per-user bcrypt** auth, **gocryptfs** encryption at rest,
**fail2ban** on brute force (§6d), and optional **Cryptomator** zero-knowledge
(§6e).

1. **DNS** — add an A record `files.<domain>` → VPS IP (Caddy needs it before
   it can issue the cert).

2. **Encryption at rest (gocryptfs).** Files land in an encrypted store; the
   container only sees the decrypted mount.
   ```
   apt-get install -y gocryptfs
   install -d -m 700 -o deploy -g deploy /opt/jvb/webdav-cipher /opt/jvb/webdav-plain
   # init the encrypted store — choose a STRONG passphrase and SAVE the printed master key offline:
   gocryptfs -init /opt/jvb/webdav-cipher
   # mount it (prompts for the passphrase):
   gocryptfs /opt/jvb/webdav-cipher /opt/jvb/webdav-plain
   ```
   Auto-remount after a reboot needs the passphrase. Either mount it by hand
   after each reboot, or install a systemd unit that reads it from a
   root-only file (`/etc/jvb/webdav.pass`, mode 600):
   ```
   # /etc/systemd/system/webdav-crypt.service
   [Unit]
   Description=gocryptfs mount for the WebDAV shared drive
   After=local-fs.target
   [Service]
   Type=forking
   ExecStart=/bin/sh -c 'gocryptfs -passfile /etc/jvb/webdav.pass /opt/jvb/webdav-cipher /opt/jvb/webdav-plain'
   ExecStop=/bin/fusermount -u /opt/jvb/webdav-plain
   RemainAfterExit=yes
   [Install]
   WantedBy=multi-user.target
   ```
   `systemctl enable --now webdav-crypt`. Caveat: a passphrase file on the box
   protects against **disk theft / decommissioning**, not a live root
   compromise (same as LUKS with a keyfile). For protection even from the
   server itself, use Cryptomator (§6e).

3. **Env + accounts.** In `compose/.env` set `WEBDAV_DATA_DIR=/opt/jvb/webdav-plain`.
   Then create the user list:
   ```
   cd /opt/jvb/infra/compose/webdav
   cp webdav.example.yml webdav.yml
   # one hash per user (prompts for the password):
   docker run --rm -it httpd:2.4-alpine htpasswd -nBC 12 "" | cut -d: -f2
   # paste each $2y$… after {bcrypt} in webdav.yml
   ```

4. **Start it + Caddy.** In `infra/compose`: `docker compose up -d webdav`.
   Put the real domain in the Caddyfile's `files.` block, then
   `mkdir -p /var/log/caddy && systemctl reload caddy`.

5. **Verify.** `curl -u <user>:<pass> -X PROPFIND https://files.<domain>/` → 207.

6. **Backups.** Already wired: the nightly `backup.sh webdav-sync` cron
   replicates the gocryptfs **ciphertext** to `…/backups/webdav` in object
   storage (encrypted by construction). Set `WEBDAV_CIPHER_DIR` in the backup
   environment and add the cron line from `backup.sh`'s header.

### Device setup
- **Mac (Finder):** ⌘K / Go → Connect to Server → `https://files.<domain>` →
  Registered User → username + password (stored in Keychain).
- **iPhone / iPad (Files app):** Browse → ⋯ → Connect to Server →
  `files.<domain>` → Registered User → credentials.

## 6d. fail2ban for the WebDAV endpoint

The Caddy `files.` block logs to `/var/log/caddy/files-access.log`; the jail
bans an IP after 5 auth failures in 10 min.
```
cp infra/security/fail2ban/filter.d/caddy-webdav.conf /etc/fail2ban/filter.d/
cp infra/security/fail2ban/jail.d/caddy-webdav.conf   /etc/fail2ban/jail.d/
systemctl restart fail2ban
fail2ban-client status caddy-webdav
```

## 6e. Cryptomator zero-knowledge vaults (free / open source)

The strongest posture: the VPS (and its backups, and anyone with disk access)
only ever sees ciphertext — ideal for client / AML material. Cryptomator is
open source (GPLv3). Use **standalone vaults**: a vault is just an encrypted
folder unlocked with a passphrase — you do NOT need the paid "Cryptomator Hub"
(a separate commercial team key-manager). A vault lives on the WebDAV share, so
no server change is needed.

- **macOS:** the desktop app is free and open source — `brew install --cask
  cryptomator` (or download from cryptomator.org). Uses macFUSE / FUSE-T or a
  built-in WebDAV mount.
- **iPhone / iPad:** the app is open source too, but Apple's App Store build is
  a small **one-time paid** purchase (there is no free App Store distribution;
  self-compiling + sideloading the FOSS source is impractical). Either pay the
  modest one-off (per Apple ID — Family Sharing can cover the devices), or let
  iOS use the plain WebDAV share (still TLS + gocryptfs-at-rest) and keep the
  vaults for Mac-only sensitive material.

Setup, per device:
1. Install Cryptomator; mount the WebDAV drive first (§6c device setup).
2. New Vault → storage location = a folder on the mounted WebDAV drive → set a
   strong shared passphrase (keep it in your password manager).
3. Unlock → a normal-looking drive appears; everything written into it is
   encrypted client-side before it reaches the server.

## 7. Upgrade procedure

Every image in `docker-compose.yml` is pinned (Studio: pin at deploy time —
record the tag in the compose file when you first deploy). To upgrade:

1. Read release notes: supabase/postgres and storage-api occasionally
   require migration steps; GoTrue minor bumps are usually safe.
2. Take an out-of-band backup: `scripts/backup.sh db`.
3. Bump ONE image tag in `docker-compose.yml` (commit the change).
4. `docker compose pull <service> && docker compose up -d <service>`.
5. Verify: `docker compose ps` healthy, smoke tests from §3, studio app
   login, an image upload end-to-end.
6. Postgres major upgrades are a special case: dump → new cluster → restore
   (plan downtime; rehearse on a throwaway VPS first).

Rollback = revert the tag and `docker compose up -d <service>` (except
Postgres once its data directory has been upgraded — hence step 2).

OS security patches are automatic (unattended-upgrades); reboots are manual:
`docker compose down && reboot` in a quiet window, `up -d` after.

## 8. Disaster recovery (VPS lost)

Recovery is: **new VPS + latest dump + Object Storage**, because all state
lives in exactly three places — Postgres (dumped nightly), Object Storage
(originals/derivatives/documents + replica), and this repo (config).

1. Provision a new instance (§1 steps 1, 3) — ~15 min.
2. Point DNS `api.` / `studio.` at the new IP (low TTL helps).
3. Clone repo, recreate `.env` from the password manager (the `.env` values
   are the ONE thing not in git — keep a copy in the manager, always
   current), install Caddyfile.
4. `docker compose up -d`, then restore the latest dump (§5).
5. Storage objects are already in Object Storage — nothing to restore unless
   the bucket itself was lost, in which case `rclone sync` back from
   `jvb-storage-replica`.
6. Run the §3 smoke tests + one end-to-end image upload; re-enable cron.

Target: < 2 hours, data loss bounded by the nightly dump (≤ 24 h).

## 9. Escape hatch — managed Postgres

If self-hosting becomes a burden (BUILD_PLAN §11), the migration path is
deliberately short because we only rely on stock Supabase primitives
(Postgres + GoTrue + PostgREST + storage-api, no self-hosted edge functions):

1. Create a managed Supabase project (or any managed Postgres for the
   DB-only variant).
2. `pg_dump -Fc` here → `pg_restore` there; re-point storage-api's S3 config
   (managed Supabase storage can keep using its own backend; objects can be
   `rclone sync`ed from Vultr to it or stay put behind a custom storage
   proxy).
3. Update `SUPABASE_URL`/keys in Vercel env; the image-worker container can
   run anywhere with a DATABASE_URL (Fly.io, Railway, or a $6 VPS).
4. Decommission: final backup, snapshot, destroy.

The schema, RLS and clients are identical on managed Supabase — no
application code changes.

## Automated bootstrap

`scripts/bootstrap.sh` automates §1–§4 of this runbook end-to-end (VPS +
Object Storage + DNS + provision + compose + migrations + first admin) and
also wires up Vercel, Sanity and Resend — see
`scripts/bootstrap.README.md` for inputs, step list and re-run semantics:

```sh
VULTR_API_KEY=… VERCEL_TOKEN=… SANITY_AUTH_TOKEN=… RESEND_API_KEY=… \
DOMAIN=<domain> ADMIN_EMAIL=<email> GITHUB_REPO=<owner/name> \
bash infra/scripts/bootstrap.sh          # --only/--from <step>, --yes
```

It is idempotent (re-runs re-use existing resources by label/name) and keeps
all generated credentials in `scripts/.bootstrap-state/` (gitignored —
**never commit it**; copy `secrets.env` into the password manager, per §8).
Backups cron, the restore drill (§5) and monitoring (§6) remain manual.


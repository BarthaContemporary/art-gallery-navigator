# Plausible Analytics — self-hosted (Community Edition)

Cookieless, GDPR-friendly web analytics for the studio app, self-hosted on the
same London VPS as Supabase. Mirrors the official reference stack at
<https://github.com/plausible/community-edition> (tag `v3.0.1`).

- **App:** `ghcr.io/plausible/community-edition:v3.0.1`
- **Metadata DB:** `postgres:16-alpine` (`plausible_db`)
- **Event DB:** `clickhouse/clickhouse-server:24.12-alpine` (`plausible_events_db`)

Because Plausible is **cookieless and stores no personal data**, no cookie
consent banner is required on the studio app.

---

## 1. Prerequisites

- Docker + Docker Compose on the VPS (already installed for the Supabase stack).
- A DNS `A` record for `analytics.<domain>` pointing at the VPS (Caddy needs it
  to obtain a Let's Encrypt certificate).
- A Resend API key (reuse the gallery's) for transactional email.

## 2. Configure

```sh
cd infra/compose/plausible
cp .env.example .env
```

Generate the two secrets and fill them into `.env`:

```sh
openssl rand -base64 48   # -> SECRET_KEY_BASE  (>= 64 bytes)
openssl rand -base64 32   # -> TOTP_VAULT_KEY
```

Then edit `.env`:

- Set `BASE_URL=https://analytics.<domain>`.
- Pick a strong Postgres password and use it in **both** `POSTGRES_PASSWORD`
  and the `PASSWORD` slot of `DATABASE_URL`.
- Set `SMTP_USER_PWD` to your Resend API key and `MAILER_EMAIL` to a from-address
  on a Resend-verified domain.
- Leave `DISABLE_REGISTRATION=true` for now — you flip it in step 4.

The ClickHouse and Postgres services are **not** published to the host; only the
app is, on `127.0.0.1:8000`. Never expose 5432/8123/9000 publicly.

## 3. Add the Caddy block

Caddy runs on the host (see `infra/compose/Caddyfile`). Add this site block
(alongside the existing `api.` / `studio.` blocks), replacing `example.com`:

```caddyfile
analytics.example.com {
	import security_headers
	reverse_proxy 127.0.0.1:8000
}
```

Then `sudo systemctl reload caddy`. Caddy provisions TLS automatically once the
`analytics.<domain>` A record resolves to the VPS.

## 4. First run — create the admin user

Registration is disabled by default so the instance stays single-user. To create
the one admin account:

1. In `.env`, temporarily set `DISABLE_REGISTRATION=false`.
2. Bring the stack up:
   ```sh
   docker compose up -d
   docker compose logs -f plausible   # watch createdb + migrate finish
   ```
3. Visit `https://analytics.<domain>` and sign up. This becomes the admin.
4. Set `DISABLE_REGISTRATION=true` again and re-apply:
   ```sh
   docker compose up -d
   ```
   (Compose recreates the plausible container with the new env; the databases
   are untouched.)

## 5. Add the studio site

Inside the Plausible dashboard → **Add a website**:

- **Domain:** use the site's data-domain. For studio this is the production
  host — e.g. `studio.<domain>` if served there, or the Vercel host
  `jvb-studio.vercel.app`. Whatever you enter here is the value that must match
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` in the studio app (step 6).

Plausible then shows the snippet; we inject it ourselves via `next/script`
(see `apps/studio/src/components/plausible.tsx`), so you don't paste it by hand.

## 6. Wire the studio app (Vercel env vars)

Set these on the **studio** Vercel project (Production, and Preview if wanted):

| Var | Value | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | the exact data-domain from step 5 (e.g. `studio.<domain>`) | Turns tracking on; must match the Plausible site. If unset, no script is rendered (local/dev stays clean). |
| `NEXT_PUBLIC_PLAUSIBLE_SRC` | `https://analytics.<domain>/js/script.js` | The tracker script URL (served by this instance). |
| `NEXT_PUBLIC_PLAUSIBLE_DASHBOARD` *(optional)* | `https://analytics.<domain>` | Target of the "Analytics" link on the studio Settings page. Falls back to `https://analytics.joostvandenbergh.com`. |

Redeploy the studio app after setting them.

## 7. Backups

- **Postgres (metadata: users, sites, settings):**
  ```sh
  docker compose exec -T plausible_db \
    pg_dump -U postgres plausible_db | gzip > plausible_db_$(date +%F).sql.gz
  ```
  Fold this into `infra/scripts/backup.sh` alongside the Supabase dump.
- **ClickHouse (event data):** either snapshot the `event-data` volume while the
  container is stopped, or use [`clickhouse-backup`](https://github.com/Altinity/clickhouse-backup)
  for consistent online backups. Event data is high-volume but non-critical
  (analytics only); the Postgres metadata is the piece worth protecting most.

## Operational notes

- Upgrades: bump the pinned `v3.0.1` tag, `docker compose pull`, then
  `docker compose up -d`. The app runs migrations on boot via its command.
- Health: `docker compose ps` should show all three services healthy.

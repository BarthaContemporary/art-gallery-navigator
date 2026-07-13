# bootstrap.sh — one-shot production bootstrap

Provisions the **entire** production stack from one machine, driven by
environment variables: Vultr VPS (self-hosted Supabase) + Vultr Object
Storage + DNS + Vercel projects (`apps/studio`, `apps/web`) + Sanity project
+ Resend sending domain. It automates the manual runbook in
`infra/README.md` §1–§4 and the Vercel/Sanity/Resend wiring from
`docs/BUILD_PLAN.md` §2/§7.

```sh
VULTR_API_KEY=… VERCEL_TOKEN=… SANITY_AUTH_TOKEN=… RESEND_API_KEY=… \
DOMAIN=jvb.example.com ADMIN_EMAIL=owner@example.com GITHUB_REPO=org/repo \
bash infra/scripts/bootstrap.sh
```

## Inputs

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VULTR_API_KEY` | yes | — | Vultr API v2: instance, object storage, DNS |
| `VERCEL_TOKEN` | yes | — | Vercel REST API: projects, env vars, domains, deploys |
| `DOMAIN` | yes | — | Base domain (apex or subdomain base), e.g. `jvb.example.com` |
| `ADMIN_EMAIL` | yes | — | First studio admin user (GoTrue + `user_roles` admin) |
| `GITHUB_REPO` | yes | — | `owner/name`, linked to both Vercel projects |
| `SANITY_AUTH_TOKEN` | no | — | Absent ⇒ Sanity steps skipped with a warning |
| `RESEND_API_KEY` | no | — | Absent ⇒ Resend + SMTP wiring skipped with a warning |
| `VERCEL_TEAM_ID` | no | personal scope | Appended as `?teamId=` to every Vercel call |
| `VULTR_REGION` | no | `lhr` | London |
| `VULTR_PLAN` | no | `vhf-4c-8gb` | High Frequency 4 vCPU / 8 GB (BUILD_PLAN §2) |
| `SSH_PORT` | no | `2222` | Hardened SSH port (passed to `provision.sh`) |
| `STATE_DIR` | no | `infra/scripts/.bootstrap-state` | Idempotency state + secrets (see below) |
| `GIT_BRANCH` | no | `main` | Branch for the initial Vercel deployments |

Hostnames derived from `DOMAIN`:

| Host | Points at | Serves |
|---|---|---|
| `$DOMAIN`, `www.$DOMAIN` | Vercel | public website (`apps/web`) |
| `admin.$DOMAIN` | Vercel | studio back-office (`apps/studio`) |
| `api.$DOMAIN` | VPS (Caddy → Kong) | Supabase API gateway |
| `db-admin.$DOMAIN` | VPS (Caddy, basic-auth) | Supabase dashboard (break-glass) |

Dependencies on the operator machine: `curl`, `jq`, `ssh`/`scp`/`ssh-keygen`,
`openssl`, `tar`, `node` (>= 18, signs the Supabase API-key JWTs). `rclone`
is optional — without it, bucket creation is skipped and manual instructions
are printed. `dig` (or `getent`) is used for DNS resolution checks.

## Steps (in order)

`secrets → vultr_server → vultr_storage → dns → provision → configure →
stack_up → migrate → admin_user → sanity → vercel → resend → smoke → summary`

(`sanity` deliberately runs **before** `vercel` so the Sanity project id and
write token can be injected into the Vercel env vars in one pass.)

Run a single step or resume mid-way:

```sh
bash infra/scripts/bootstrap.sh --only vercel        # just one step
bash infra/scripts/bootstrap.sh --from stack_up      # resume from a step
bash infra/scripts/bootstrap.sh --yes                # no prompts / DNS waits
```

## What gets created where

| Where | Resource | Identifier |
|---|---|---|
| Vultr | VPS instance (Ubuntu 24.04) | label `jvb-supabase` |
| Vultr | SSH key | name `jvb-bootstrap` |
| Vultr | Object Storage + buckets `jvb-storage`, `jvb-storage-replica`, `jvb-backups` | label `jvb-storage` |
| Vultr DNS | `api.` / `db-admin.` A records, Vercel CNAMEs, Resend SPF/DKIM/MX | only if the zone is managed on Vultr; otherwise records are printed for manual creation |
| VPS | hardened box per `provision.sh`, repo subtree at `/opt/jvb`, rendered `.env` + `Caddyfile`, running compose stack, applied migrations, admin user | — |
| Vercel | projects | `jvb-studio` (root `apps/studio`), `jvb-web` (root `apps/web`) |
| Sanity | project + dataset + robot token | `JVB Gallery` / `production` / token `jvb-sync` |
| Resend | sending domain | `$DOMAIN` (region `eu-west-1`) |

**Cost note:** ~$48/mo for the VPS (vhf-4c-8gb) + ~$18/mo for 500 GB Object
Storage, plus your Vercel/Sanity/Resend plans. The script asks for
confirmation before creating paid resources (skip with `--yes`).

## Idempotency / re-runs

Re-running is the intended recovery path after any failure. Every *create*
first looks the resource up by label/name and re-uses it; generated secrets
are created once and then read from `STATE_DIR/secrets.env`; applied SQL
migrations are recorded in the `public._bootstrap_migrations` table and
skipped on re-run; Vercel env vars use `?upsert=true`; DNS records are
upserted by name+type. Nothing is ever duplicated or rotated implicitly.

Two things can NOT be recovered by a re-run and are warned about instead:

- the **Sanity token value** (`jvb-sync`) can only be read at creation — if
  it exists but is missing from `secrets.env`, delete it in
  [sanity.io/manage](https://www.sanity.io/manage) and re-run `--only sanity`;
- the **SSH port switch** — once `provision.sh` has run, root@22 is gone by
  design; the script detects this and connects as `deploy@:$SSH_PORT`.

## State directory — contains LIVE credentials

`STATE_DIR` (default `infra/scripts/.bootstrap-state/`, chmod `700`) holds:

- `secrets.env` (chmod `600`) — Postgres password, `JWT_SECRET`,
  `ANON_KEY`/`SERVICE_ROLE_KEY`, S3 keys, Sanity write token, shared
  secrets, the studio-dashboard password and the admin user's password;
- `id_ed25519[.pub]` — the SSH keypair that is the **only** login to the VPS;
- `state.env`, `known_hosts` — resource ids/IPs (non-secret).

It is listed in the root `.gitignore` and must **never** be committed,
copied to shared storage, or left on a shared machine. After a successful
bootstrap, copy `secrets.env` into the gallery's password manager (it is the
one thing not recoverable from git — see `infra/README.md` §8) and store the
SSH key alongside it.

## Security notes

- Secret **values are never printed** — logs only ever name the variable and
  where it was stored. Secrets do transit process arguments of local `curl`
  calls (API bodies), so run this on a trusted single-user machine.
- The deploy user gets passwordless sudo for exactly one root helper
  (`/usr/local/bin/jvb-install-caddyfile`) — nothing else.
- **Rotate every operator token** pasted into the shell (`VULTR_API_KEY`,
  `VERCEL_TOKEN`, `SANITY_AUTH_TOKEN`, `RESEND_API_KEY`) once bootstrap is
  done; they are far more powerful than the stack needs day-to-day.
- Generated passwords/secrets are URL-safe base64 (`-`/`_` alphabet) so they
  are safe inside `postgres://` URLs; `JWT_SECRET` is standard base64
  (48 bytes).

## What remains manual

Printed by `step_summary`: nameserver/DNS records when the zone is not on
Vultr; the Vercel GitHub app install if project↔repo linking failed; the
Sanity Studio schema deploy; waiting for Resend domain verification; backup
cron + healthchecks.io + the restore drill (`infra/README.md` §5); and the
token rotation above.

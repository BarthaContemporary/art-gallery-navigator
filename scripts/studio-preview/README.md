# Studio preview

A local copy of the studio running against **fictional data**, for looking at
and screenshotting the signed-in pages without the live database or a real
login. It is never pointed at the live database or any live service:

- `mock-supabase.mjs` stands in for Supabase (auth, PostgREST and storage) on
  `127.0.0.1:54321`, answering from `fixtures/data/*.json` held in memory.
- `start.mjs` runs the studio under `next dev` on port 3011 with only the
  mock's URL and dummy keys in its environment. Resend, Sanity, CalDAV,
  Plausible, the shared drive and the AI keys are unset, so those panels show
  their "not configured" states. It refuses to start if `apps/studio` has a
  `.env` file next.js would load.
- `shoot.mjs` aborts every browser request that is not to localhost, and
  routes Chromium's own traffic to a proxy that does not exist.

Every person in the fixtures is invented (example.com emails, Ofcom drama
phone numbers, streets that do not exist with `ZZ` postcodes). The makers are
real artists from the gallery's published catalogues, with no invented
biography.

Nothing here needs installing into the repo: plain Node 22 ESM, the studio's
own `node_modules`, and a `playwright-core` from anywhere on disk.

## Start, shoot, stop

```sh
node scripts/studio-preview/start.mjs     # idempotent; waits until both answer
node scripts/studio-preview/shoot.mjs --out /tmp/shots/before --full
node scripts/studio-preview/stop.mjs      # stops only what start.mjs started
```

`start.mjs` launches both servers detached, so they outlive the shell; pid
files and logs are in `.run/` (`mock.log`, `studio.log`). The first request
to each route compiles it, which takes a few seconds in `next dev`.

To browse by hand, open http://localhost:3011/login and sign in as
`harriet.lowe@example.com` (admin) or `sam.okafor@example.com` (staff) with
any password, or set the session cookie `shoot.mjs` uses (see
`lib/session.mjs`). The Turnstile check is off because its keys are unset.

### shoot.mjs

| Option | Default | |
|---|---|---|
| `--routes <file\|list>` | `routes.json` | a routes file, or a comma list of paths or route names |
| `--areas a,b` | all | only routes with these area tags (`shell`, `inventory`, `record`, `crm`, `ops`, `ui-kit`) |
| `--match <regex>` | | only routes whose path or name matches (with `--areas`: either) |
| `--out <dir>` | `.run/shots/<time>` | where the JPEGs and `report.json` go |
| `--widths` | `375,768,1440` | viewport widths (below 1024 the viewport is a touch device) |
| `--schemes` | `light,dark` | colour schemes; also written to the studio's `jvb-theme` storage |
| `--role admin\|staff` | `admin` | who is signed in |
| `--full` | off | full page, capped at 8000 px high |
| `--concurrency <n>` | 3 | viewports shot in parallel |
| `--no-warm` | off | skip compiling every route once before shooting |
| `--merge` | off | fold the results into an existing `report.json` in `--out` (same route, width and scheme replaced), to re-shoot a few pages |

`playwright-core` is loaded from `PLAYWRIGHT_CORE` (its package directory)
when set, else by a plain import. Chromium is `CHROMIUM` when set, else
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` if present, else
Playwright's own.

Each shot waits for requests to stop (counted by hand, up to 45 s, since
`next dev` compiles an API route on its first call), fonts, and entrance
animations, then saves a JPEG at quality 72. `report.json` records, per route
and size: HTTP status, final URL (a redirect to `/login` fails the shot),
console errors, uncaught errors, whether the error boundary or the 404 page
rendered, failed same-origin requests, external hosts the page tried, and
horizontal overflow (`scrollWidth > innerWidth`). A shot is `ok` when the
status is 200, it was not sent to sign-in, and nothing failed or threw.

`next dev` restarts itself when its heap nears the limit, which a full set
of shots can reach; a shot dropped that way (no response, connection reset)
is taken again once the server answers, and the report notes `retriedAfter`.

Examples:

```sh
# Staff view of inventory, records and the stock book at desktop width
node scripts/studio-preview/shoot.mjs --role staff --widths 1440 --schemes light \
  --areas inventory,record --match '^/stock-book' --full --out /tmp/shots/staff
# One page, both schemes, phone width
node scripts/studio-preview/shoot.mjs --routes /offers --widths 375
```

## Routes

`routes.json` has one entry per `page.tsx` under `apps/studio/src/app` (40),
plus variants showing another state of the same page (an empty list, a work
without images, a part-sent newsletter, each stock-book scheme). `adminOnly`
marks pages that refuse or redirect other roles; `session: false` pages are
shot signed out (the middleware sends a signed-in user from `/login` to the
dashboard); `redirectsTo` marks pages that are redirects by design. The `ui-kit`
area is `/ui-kit`, the dev-only page showing every shared component
(`apps/studio/src/components/ui`) in every state; it is a 404 in production.

## Fixtures

`fixtures/generate.mjs` writes `fixtures/data/<table>.json`. It is seeded and
derives every id from a counter, so rerunning it gives the same ids and the
ids in `routes.json` stay valid. To add or change data, edit the generator,
then:

```sh
node scripts/studio-preview/fixtures/generate.mjs
curl -X POST http://127.0.0.1:54321/__preview/reset   # reload without restarting
```

Append new rows at the end of a section (or give them their own `uid()` tag)
so existing ids do not move. Dates are written relative to the anchor date in
`_meta.json`; the mock moves every ISO date by the days between the anchor and
today, so "tomorrow's appointment" and "overdue request" stay true.
`PREVIEW_DATE_SHIFT=0` turns that off.

Deliberate edge cases: about 120 works in both registers and every status, a
very long title, works without images (every ninth), an image still
processing and one that failed, null prices, a sale below cost, two cleared
purchase figures ("Needs purchase £"), trashed works, makers with Japanese
native names and one with no works, an empty list, a 64-work list, live
lists, a part-sent newsletter, an untitled draft, an expired offer and a
refused offer send, requested, confirmed, cancelled and no-show appointments,
overdue data-protection requests, a sanctions potential match, duplicate
contacts, an erased contact, legacy FileMaker issues.

Writes (autosave, buttons, server actions) change the in-memory data for the
session; a restart or `/__preview/reset` puts the fixtures back. Uploads are
kept in memory too.

## What the mock covers

- **Auth**: `GET /auth/v1/user` from the bearer token's `sub`, token refresh,
  password sign-in for the two fictional users, the admin user list and
  invite link. The session cookie is `sb-127-auth-token`, value `base64-` plus
  the base64url of the session JSON, as `@supabase/ssr` 0.6.1 stores it; see
  `lib/session.mjs` for why that is enough for the middleware's `getUser()`.
- **REST** (`lib/postgrest.mjs`): select with aliases, casts, JSON paths,
  embeds (`alias:table!hint(cols)`, `!inner`, spreads, `rel(count)`) resolved
  through the foreign keys in `lib/schema.mjs`; filters `eq neq gt gte lt lte
  like ilike match in is isdistinct cs cd ov fts`, `not.`, `or=( )`/`and=( )`;
  order with nulls placement; limit, offset and `Range`; `Prefer:
  count=exact`; `HEAD`; single-object responses (406 when no row); inserts,
  upserts, updates and deletes. Views (`vw_pieces_list`, `vw_pieces_all`, the
  stock-book views, `vw_contacts_for_review`, `piece_ref`) are computed from
  the tables on every read. Staff get the coarse RLS of `lib/schema.mjs`
  (no financials, change history or data-protection registers).
- **RPC** (`lib/rpc.mjs`): every function the studio calls.
- **Storage**: signing (single, batch, upload) returns URLs served by the
  mock; images are drawn per path (`lib/images.mjs`) in the object's recorded
  proportions, resized for transform requests; PDFs are a one-page stub.

## Unanswered requests

Anything the mock cannot answer (a table with no fixture, an RPC it does not
know, an embed with no relationship, an unsupported operator or endpoint) gets
an empty result and one line in `.run/unanswered.log`:

```json
{"time":"…","method":"GET","path":"/rest/v1/some_table","query":"?select=*","reason":"no fixture for table or view \"some_table\""}
```

Repeats are counted rather than logged again; `GET
http://127.0.0.1:54321/__preview/unanswered` lists them with counts. A page
that renders oddly is usually explained by a line here.

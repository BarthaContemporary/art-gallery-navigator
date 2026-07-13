# @jvb/web — public website

The public-facing gallery site: works catalogue, collections, exhibitions,
journal, booking, and the tokenized private offer pages. Next.js 15 App
Router, React Server Components throughout (the only client components are
the booking form and the offer "I'm interested" control).

## How the pieces fit together

```
Supabase (self-hosted, source of truth)      Sanity (editorial)
  pieces / piece_images / offers / crm  --->   work docs (read-only, synced)
        |                                      pages, journal, exhibitions,
        |  service-role client                 collections, siteSettings
        v                                            |
  /o/[token]  /api/booking  /api/offer-response      |  CDN + GROQ
  /api/unsubscribe/[token]                           v
                                    /  /works  /collections  /journal  ...
```

- **Sanity owns editorial.** Pages under `/works`, `/collections`,
  `/exhibitions`, `/journal`, `/about`, `/contact` read from Sanity via
  `src/lib/sanity.ts` (tag-cached; a Sanity webhook hits `/api/revalidate`
  to invalidate by document type). Work images are served from the Sanity
  CDN — public traffic never touches the VPS.
- **`work` documents are read-only** in Sanity. The **studio app**
  (`apps/studio`) pushes web-visible pieces to Sanity from its
  `/api/sync/sanity` endpoint (outbox-driven), uploading display masters as
  Sanity assets and writing docs with ids `work-{supabaseId}`. This app
  never writes to Sanity.
- **Supabase powers the private/transactional surfaces** via the
  service-role client from `@jvb/db`: tokenized offers (`/o/[token]`, with
  1-hour signed URLs from the private `piece-derivatives` bucket), booking
  (`/api/booking` → `appointments` + Resend confirmation with an ICS
  attachment built by `src/lib/ics.ts`), offer responses (`enquiries`), and
  newsletter unsubscribes (`crm_contacts.unsubscribed_at`).
- **Schemas** for the separately-deployed Sanity Studio live in
  `sanity/` — see `sanity/README.md`.

## Development

```sh
# from the repo root
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in values
pnpm --filter @jvb/web dev                     # http://localhost:3001
```

Every Sanity/Supabase call degrades gracefully when env vars are absent
(empty states instead of crashes), so the site builds and boots without
credentials — useful for CI and first checkout.

## Environment

See `.env.example` for the full annotated list. In short: Sanity project id
+ dataset + revalidate secret; Supabase URL + anon + service-role keys;
Resend API key + sender + staff notification address; and the canonical
`NEXT_PUBLIC_SITE_URL`.

## SEO / AEO

- `Metadata` exports everywhere; per-work OpenGraph images from the Sanity CDN.
- JSON-LD: `ArtGallery` (root layout), `VisualArtwork` + `BreadcrumbList`
  (work pages), `FAQPage` (`/faq`).
- `src/app/sitemap.ts` and `robots.ts` route handlers (offer + API routes
  disallowed; `/o/[token]` additionally sets robots noindex metadata).
- `/llms.txt` describes the gallery and how to cite works.
- Work facts are rendered as semantic `<dl>` lists so answer engines can
  lift maker / period / region / medium directly.

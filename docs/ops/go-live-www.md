# Go-live: www.joostvandenbergh.com from Squarespace to the new site

The new website (Vercel project jvb-web, today at https://jvb-web.vercel.app)
takes over www.joostvandenbergh.com. The bare domain keeps redirecting to www,
as it does on Squarespace, so search rankings and existing links carry over.
Every one of the 76 addresses in the old Squarespace sitemap already lands on
its matching new page, and the old /search link and pre-Squarespace addresses
are redirected too.

Who does what: you change Vercel, GoDaddy, Cloudflare and Sanity. Claude checks
DNS, certificates and pages from outside and changes code.

## 1. Before launch day

1. **GoDaddy: shorten how long the old answers are cached.** My Products →
   joostvandenbergh.com → DNS. Edit the four `A @` rows and the `CNAME www`
   row: TTL = Custom, 600 seconds. Change nothing else. They are cached for
   8600 seconds today, so wait at least 2 hours 24 minutes before step 3.3.
   This also makes a rollback fast.
2. **Cloudflare Turnstile: allow the new address.** Cloudflare, account
   Joostvandenberghproject@gmail.com → Turnstile → the widget whose site key
   starts `0x4AAAAAAD` → Hostname management. `joostvandenbergh.com` must be
   in the list (it covers www). Keep `studio.joostvandenbergh.com` and
   `jvb-web.vercel.app`. Without this, the appointment, enquiry and offer
   forms cannot be sent from www.
3. **Vercel plan.** Team "Joost van den Bergh Project" → Settings → Billing
   must say Pro. The free plan is for non-commercial use and caps image
   processing, which a search-engine crawl of the real domain can exhaust.
4. **Legal pages.** The privacy, terms, cookie and AML pages were drafted to
   be checked by a solicitor before launch. Either get that sign-off or decide
   to launch with the drafts.
5. **Company details.** Sanity Studio (joostvandenbergh.sanity.studio) → Site
   settings: fill in the legal name, company number, registered office and VAT
   number, then Publish. They appear in the footer and the Privacy Notice; a
   limited company must show them on its website.
6. **Frieze Masters page title.** Sanity → Events → "chūshōteki - Frieze
   Masters 2026" → SEO title: clear it. It repeats the gallery name, so the
   browser tab reads "Joost van den Bergh | … — Joost van den Bergh".
7. **Optional: duplicate artist pages.** Kanamori Eiichi and Tsuda Shinobu
   each have two pages, and a few names are misspelt (for example "Watanebe
   Tadashi", "Nishikawa Mistuo"). Merge or hide one of each in the studio's
   makers list, ideally before search engines index www.

## 2. Launch: Vercel first

1. **Domains.** jvb-web → Settings → Domains.
   - Add `www.joostvandenbergh.com`, connected to Production, no redirect.
   - Add `joostvandenbergh.com` and choose "Redirect to
     www.joostvandenbergh.com" (308). Do not accept a suggestion to redirect
     www to the bare domain.
   - Write down the A value Vercel shows for the bare domain (normally
     `76.76.21.21`) and the CNAME target it shows for www. "Invalid
     Configuration" is expected until the DNS change.
   - Leave jvb-web.vercel.app attached and public: links already emailed use it.
2. **Settings (save, do not redeploy yet).** Type each value by hand, with no
   spaces or trailing slash.
   - jvb-web, Production: `NEXT_PUBLIC_SITE_URL` = `https://www.joostvandenbergh.com`
   - jvb-web, Production: re-enter `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` = `joostvandenbergh.com`
     (the current value starts with a stray tab)
   - jvb-web, Production: `GALLERY_NOTIFICATIONS_EMAIL` = Joost's address
   - jvb-studio, Production: `OFFER_LINK_BASE_URL` = `https://www.joostvandenbergh.com`

   These take effect only after a redeploy, which waits until www answers from
   Vercel (step 3.5). Redeploying earlier would send newsletter confirmation
   links to Squarespace.

## 3. Launch: GoDaddy, then checks

1. **Only after the 2 h 24 min wait from step 1.1.**
2. Have this page open for the rollback values (section 4).
3. **The DNS switch, in one sitting.** GoDaddy → DNS → Records:
   - Delete `A @ 198.185.159.145`, `A @ 198.49.23.144` and `A @ 198.49.23.145`.
   - Edit `A @ 198.185.159.144`: value = the A value from step 2.1, TTL 600.
     Exactly one `A @` row must remain.
   - Edit `CNAME www`: value = the target from step 2.1 (or
     `cname.vercel-dns.com`), TTL 600.
   - Add no AAAA record and do not turn on GoDaddy forwarding.
   - **Touch nothing else.** Mail and the other services depend on these, and
     none of them shares a name with `A @` or `CNAME www`: the MX records
     (Proton), the TXT records at @ (SPF, Proton verification), `_dmarc`, the
     `protonmail._domainkey` CNAMEs, `send.web` and `resend._domainkey.web`
     (website email), `studio` and `capture` (Vercel), `cal` and `drive` (the
     server), and `_domainconnect`.
4. **Tell Claude "DNS switched".** Claude checks from outside that every
   resolver gives the new answers, mail records are unchanged, www answers from
   Vercel with a valid certificate, and the bare domain redirects to www. In
   Vercel, both domains should then show "Valid Configuration".
5. **Redeploy, once Claude confirms.** jvb-web → Deployments → the latest
   Production deployment → ⋯ → Redeploy. Do the same in jvb-studio.
6. **Claude's checks after the redeploy:** robots.txt, the sitemap, canonical
   addresses and share links all name www; the old addresses still land on
   their pages; jvb-web.vercel.app still answers.
7. **Your checks on www,** with the browser's console open: send one enquiry
   from a work and one appointment request. There must be no anti-spam error
   and both emails must arrive. In Plausible, if Site settings → Shields →
   Hostnames has any rule, add `www.joostvandenbergh.com`. Accept analytics in
   the site's cookie drawer and check the visit appears in Realtime.

## 4. Rollback (keep for one to two weeks)

GoDaddy: set `A @` back to `198.185.159.144` and add `198.185.159.145`,
`198.49.23.144` and `198.49.23.145`. Set `CNAME www` back to
`ext-cust.squarespace.com`, TTL 600. Then in Vercel set jvb-web
`NEXT_PUBLIC_SITE_URL` and jvb-studio `OFFER_LINK_BASE_URL` back to
`https://jvb-web.vercel.app` and redeploy both. This only works while the domain
is still connected in Squarespace, so do not disconnect it yet.

## 5. After launch

- **Google and Bing (day 1).** In Google Search Console add a Domain property
  for joostvandenbergh.com, add its TXT record at GoDaddy, verify, and submit
  `https://www.joostvandenbergh.com/sitemap.xml`. Then import into Bing
  Webmaster Tools.
- **Webhooks (day 1).** Sanity (sanity.io/manage → dql8z4kv → API → Webhooks)
  and the gallery's Resend account (Webhooks): if a URL is on
  jvb-web.vercel.app, change only the host to `https://www.joostvandenbergh.com`.
  Use www, not the bare domain: it redirects, and a redirected POST is lost.
- **After one to two stable days.** Set the TTL on `A @` and `CNAME www` back
  to 1 hour. Claude then redirects jvb-web.vercel.app pages to www (keeping
  its /api/ addresses for links already sent), and points the studio's
  fallback links at www.
- **After one to two weeks.** In Squarespace, save anything still wanted (the
  Double Take "Encore" recording), then Settings → Domains →
  joostvandenbergh.com → Disconnect. Re-check GoDaddy afterwards: Squarespace
  can remove records it thinks it owns. Cancel the Squarespace plan last.
- **Smaller items.** The site has no favicon or share image yet (needs the
  logo). The cookie notice names analytics.joostvandenbergh.com, which does not
  exist. The FAQ and Glossary pages are not linked from anywhere. The SPF record
  still includes GoDaddy's mail servers.

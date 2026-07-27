# CEIS — Open questions for the operator

**Date:** 2026-07-27 · Answer at or before Checkpoint 0 (spec §9, Hard Rule 10).
Each carries a recommended default, so this can be approved by exception.

Spec §9 asks 15 questions. Discovery answered 7 of them from the environment
(§ below). **8 need you.**

---

## Answered by discovery — confirm only if wrong

| # | Question | Answer from the environment |
|---|---|---|
| 2 | Web properties in scope | `joostvandenbergh.com` (`apps/web`). Server routes already exist there, so `/collect` and `/r/{token}` are same-site. **`studio.` must never be tracked** |
| 3 | Sending platform | Resend, composing in-app via `packages/emails`. Read-only integration around it; link-wrapping feasible because we author the HTML |
| 4 | Contact sources | `crm_contacts` (869) is authoritative; `legacy_filemaker_rows` holds the raw migration snapshot |
| 6 | Object catalog | `pieces` (1,088) is the system of record; public URLs are `/works/[slug]` via `sanity_sync_state` |
| 8 | Staff auth | Supabase GoTrue + passkeys, `user_roles` = admin/staff/accountant |
| 9 | Jurisdiction | UK business, international collectors → UK GDPR + PECR. `/privacy` and `/cookies` pages exist |
| 13 | LLM availability | Anthropic SDK already in production use → briefs available, not deferred |

---

## Needs your answer

**Q1 · Scope of entity (§9.1).**
CEIS for the gallery only, or also artist-side/other brands?
*Recommended: gallery only. Single sending identity. Revisit if that changes.*

**Q2 · Consent banner — the one real build (§9.9, R9).**
Today Plausible is cookieless so no banner is needed. CEIS's visitor tracking stores
a `vid`, which under PECR requires consent. That means a banner appears on the
public site for the first time.
**Do you accept a consent banner on joostvandenbergh.com?** If not, CEIS still works
— you keep email clicks, purchases, RSVPs, enquiries and appointments, and lose only
anonymous on-site browsing trails.
*Recommended: accept it. But this is a visible change to a public site you've just
redesigned, so it is your call, not mine.*

**Q3 · Existing list consent basis (§9.10).**
`crm_contacts` records `marketing_consent`, `consent_date`, `consent_source`. Is the
*evidence* behind those retrievable (signup records, an import provenance note), or
is the flag all that survives?
*Recommended: seed the CEIS ledger from the existing flags with
`evidence='migrated:crm_contacts'` and treat it as the opening balance — honest
about what we know.*

**Q4 · Staff & roles (§9.7).**
Who may merge contacts, erase, enable flows, and see wealth-adjacent fields?
*Recommended: `admin` for all four; `staff` gets read + propose + approve. Matches
the existing financials gating.*

**Q5 · `price_band` (§5.8.6).**
The field doesn't exist today. Do you want it at all?
*Recommended: **no** — don't add it. It's the highest-risk field in the spec for the
lowest return, and it is trivially added later if you miss it.*

**Q6 · Sales & attendance backfill (§9.5).**
58 sold works give scoring real history. Do guest lists, past RSVPs or fair-visitor
records exist anywhere (spreadsheets, email, notebooks) worth importing?
*Recommended: import the 58 sales in Phase 1 regardless; treat guest lists as a
Phase 5 nice-to-have if they turn out to exist in usable form.*

**Q7 · Occasion cadence (§9.14).**
How many exhibitions/openings/fairs a year? `exhibitions` is currently empty, so I
can't infer it. This sets how much Phase 5 matters.
*Recommended: if under ~4/year, keep Phase 5 minimal.*

**Q8 · Naming (§9.15).**
"CEIS" is a spec codename. What should it be called in the studio nav?
*Recommended: **"Engagement"** — plain, matches the existing nav's tone
(Inventory, Contacts, Offers, Analytics).*

---

## Two things I'd flag before you answer

**The Hotlist will be thin for weeks.** Engagement tables are empty today
(`crm_interactions` 0, `crm_campaign_recipients` 0). Backfilled purchases carry
Phase 4, but the ranking only becomes genuinely useful after Phases 2–3 have been
live long enough to accumulate clicks and views — realistically 4–6 weeks. Worth
knowing so Phase 4 sign-off isn't judged against an unfair expectation.

**Restore drill first.** ADR-000 puts CEIS migrations in the same database as your
inventory. Backups now run nightly on systemd timers and are verified, but a dump
has still never been *restored*. I'd complete that drill before Phase 1 writes any
schema — it's ~20 minutes and it's the difference between a backup and a hypothesis.

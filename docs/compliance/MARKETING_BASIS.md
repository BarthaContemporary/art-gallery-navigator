# Marketing emails — who may be emailed and why (PECR reg. 22)

Email marketing to an individual needs either **consent** or the **soft opt-in**:
the person bought (or negotiated to buy) from us, we told them at the time they
could opt out, and every message offers an opt-out.

## How the system records it

- `marketing_consent` with `consent_date`, `consent_source` and, for website
  sign-ups since October 2026, `consent_evidence` (the exact wording, version,
  time, browser and hashed IP; `confirmed_at` once the double opt-in link is
  opened).
- Campaigns only go to contacts with consent, an email, no `do_not_mail`, no
  `unsubscribed_at` and no `email_bounced_at`.
- Every campaign carries an unsubscribe link and one-click headers; a spam
  complaint sets `unsubscribed_at` automatically.

## The legacy list (decision required)

868 contacts imported from the previous system carry the note "Pre-existing
client consent, confirmed by the gallery". Of the 198 with an email address,
**181 have never transacted with the gallery** in the system's records, so
neither consent nor the soft opt-in can be shown for them. They are listed in
Admin → Data protection → "Marketing without evidenced basis".

Options, in order of preference:

1. **Re-permission campaign** (recommended): one email asking them to confirm
   they wish to keep receiving news, linking to the newsletter sign-up (double
   opt-in). After 30 days, untick marketing consent for anyone who did not
   confirm. Sending that one email relies on our legitimate interest in
   regularising the list; the ICO expects it to be a single message.
2. **Document the basis** where it genuinely exists outside the system (an
   invoice, a signed fair form, a prior email asking to be kept informed): add a
   note to the contact's consent source.
3. **Untick marketing consent** for the rest.

Do not run another newsletter to the 181 until one of these has been done.

## Corporate contacts

PECR's consent rule applies to individuals; emails to a company's generic
address are allowed with an opt-out. Named individuals at institutions are
treated as individuals.

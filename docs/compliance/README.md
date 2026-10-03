# Compliance pack — UK data protection and art-market regulation

How the gallery system meets UK GDPR, the Data Protection Act 2018, PECR and the
regulations that apply to a UK art dealer, what the software does automatically,
and what the business must do itself. Last reviewed October 2026.

| Document | What it is |
|---|---|
| [OWNER_CHECKLIST.md](OWNER_CHECKLIST.md) | Things only the business can do: registrations, contracts, decisions. Start here. |
| [ROPA.md](ROPA.md) | Record of processing activities (Art. 30). |
| [RETENTION_SCHEDULE.md](RETENTION_SCHEDULE.md) | What is kept for how long, and what enforces it. |
| [PROCESSORS.md](PROCESSORS.md) | Every third party that touches personal data, where, and the transfer safeguard. |
| [SAR_PROCEDURE.md](SAR_PROCEDURE.md) | Handling access, erasure and other data-subject requests. |
| [BREACH_PROCEDURE.md](BREACH_PROCEDURE.md) | What to do in the first 72 hours of a personal-data breach. |
| [MARKETING_BASIS.md](MARKETING_BASIS.md) | PECR: who may be emailed and why; the re-permission plan for the legacy list. |
| [DPIA_AML_SCREENING.md](DPIA_AML_SCREENING.md) | Data protection impact assessment for due diligence and sanctions screening. |

## What the system does for you

- **Consent**: double opt-in newsletter; evidence of every website consent
  (text shown, version, time, browser, hashed IP) stored on the contact; every
  marketing email carries an unsubscribe link and one-click `List-Unsubscribe`
  headers; a spam complaint withdraws consent automatically and a permanent
  bounce stops further sends.
- **Cookies**: nothing non-essential loads until the visitor chooses; Accept and
  Decline carry equal weight; the choice can be reopened from every footer.
- **Rights**: subject-access export (printable and JSON) and an erasure routine
  that deletes everything not under a legal hold and pseudonymises the rest,
  from the contact page; a request register with the one-month deadline.
- **Retention**: a schedule enforced nightly, editable in Admin → Data
  protection; review queues for anything that needs a human decision.
- **Security**: UK hosting, encrypted backups, role-based access with
  row-level security, passkeys, 12-character minimum passwords, HTTPS-only with
  HSTS and other security headers, full change log.
- **AML**: due-diligence records with a five-year hold, fortnightly screening
  of verified clients against the UK Sanctions List with human review of hits.
- **Transparency**: Privacy Notice, Cookie Policy, Terms, AML notice and
  Accessibility statement, plus trading disclosures in the footer once the
  legal name, company and VAT numbers are entered in site settings.

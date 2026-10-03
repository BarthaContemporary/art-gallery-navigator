# Retention schedule

Enforced by `apply_retention()` (nightly at 03:30 UTC via `/api/cron/retention`)
using the periods in `retention_policies`, editable in Admin → Data protection.
"Purge" classes are deleted automatically; "review" classes are listed for a
person to decide. The Privacy Notice quotes these periods: change both together.

| Data | Period | Mode | Why |
|---|---|---|---|
| Email delivery events | 2 years | purge | Proving delivery, handling complaints |
| Private-offer page views (IP, browser) | 2 years | purge | Security of private links |
| Newsletter send records per contact | 3 years | purge | Evidence of PECR compliance |
| Website enquiries | 3 years | purge | Pre-contract correspondence |
| Appointment bookings | 2 years after the appointment | purge | Contract |
| Newsletter sign-ups never confirmed | 30 days | purge | Consent never completed |
| Studio change history | 6 years | purge | Accounting and provenance |
| Inventory records in the trash | 30 days | purge (existing) | Undo window |
| Contacts with no activity, no consent, no hold | 5 years | review | Data minimisation; never deleted automatically |
| AML due-diligence records | 5 years after the relationship ends | review | MLR 2017 reg. 40 — delete when the hold ends |
| Purchase, sale, consignment and order records | 6 years after the tax year | never purged by the system | Companies Act / VAT law |
| Suppression record (unsubscribed, bounced, erased) | Indefinite, minimal | kept | Needed to honour the opt-out |
| Backups | 30 daily, 12 monthly | rotated by `backup.sh` | Business continuity |

Erasure requests override the schedule: `erase_contact()` deletes everything not
under a legal hold immediately and pseudonymises what must stay.

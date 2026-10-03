# Owner checklist — what only the business can do

Software cannot register the business or sign contracts. Each item below is a
decision or an action for the gallery's principal. Tick them off in order.

## Data protection (ICO)

- [ ] **Pay the ICO data-protection fee** and keep the registration current
      (Data Protection (Charges and Information) Regulations 2018). A small
      business pays tier 1 (£40–£60 a year). ico.org.uk/fee.
- [ ] **Name a data-protection lead** (no statutory DPO is needed for a
      gallery). Put their email in Sanity → Site settings → Data-protection
      contact email; it appears on the Privacy Notice.
- [ ] **Enter trading disclosures** in Sanity → Site settings: legal name,
      company number, registered office, VAT number, trade memberships. They
      show in the footer and the Privacy Notice (Companies Act 2006 s.82,
      E-Commerce Regulations 2002 reg. 6, VAT Regulations 1995).
- [ ] **Solicitor review** of the Privacy Notice, Terms, Cookie Policy, AML
      notice and Accessibility statement before relying on them.
- [ ] **Sign or download the data-processing agreement** with each processor
      in [PROCESSORS.md](PROCESSORS.md) and file the copies.
- [ ] **Decide the legacy mailing list** — see [MARKETING_BASIS.md](MARKETING_BASIS.md).
      181 emailable contacts have no evidenced basis for marketing.
- [ ] **Confirm the retention periods** in Admin → Data protection; they are
      quoted in the Privacy Notice.
- [ ] **Staff training**: everyone with a studio login reads SAR_PROCEDURE and
      BREACH_PROCEDURE once a year; record the date.
- [ ] **Annual review** of ROPA, Privacy Notice and processors (diary it).

## Anti-money laundering (HMRC)

- [ ] **Register with HMRC as an art market participant** before any
      transaction of €10,000 or more, and renew annually (MLR 2017 reg. 56).
- [ ] **Written AML policy, risk assessment and controls** (reg. 18–19), a
      nominated officer (reg. 21), and staff training records.
- [ ] **Customer due diligence** before every €10,000+ transaction, recorded in
      the contact's AML section; enhanced due diligence for PEPs and
      high-risk countries. Keep records five years after the relationship ends.
- [ ] **Sanctions**: review every "potential match" the fortnightly screen
      emails; if a true match, freeze and report to OFSI (Sanctions and
      Anti-Money Laundering Act 2018). Screening only covers clients marked
      verified — check anyone else by hand before a sale.
- [ ] **Suspicious activity**: the nominated officer reports to the NCA; tell
      no one else (tipping off is an offence).
- [ ] **Cash**: never accept €10,000 or more in cash (high-value dealer rules).

## Selling works

- [ ] **Export licences** from Arts Council England for works above the age
      and value thresholds leaving the UK (Export Control Act 2002); temporary
      exports for fairs too.
- [ ] **Ivory Act 2018**: no sale of ivory without a registered exemption;
      **CITES** permits for protected species (tortoiseshell, coral, rosewood…).
- [ ] **Consumer sales at a distance** (email, phone, online): give the 14-day
      cancellation information before the sale and on the invoice (Consumer
      Contracts Regulations 2013); works made to order are exempt.
- [ ] **Prices to consumers** quoted VAT-inclusive; no misleading "was/now"
      pricing (Digital Markets, Competition and Consumers Act 2024).
- [ ] **VAT margin scheme** records — the stock book in the studio is the
      HMRC record; invoices must carry the margin-scheme wording.
- [ ] **Accounting records** six years (Companies Act 2006 s.388, VAT Act).

## Website and marketing

- [ ] **Cookie choices** stay as built: no new tag may be added outside the
      consent gate (Meta pixel ID lives in Site settings).
- [ ] **Equality Act 2010**: reasonable adjustments on request — the
      Accessibility page says five working days.
- [ ] **Instagram and other channels**: the same consent rules apply to direct
      messages used for marketing.

## Security and infrastructure

- [ ] Redeploy the Supabase compose stack to apply the 12-character password
      minimum (`GOTRUE_PASSWORD_MIN_LENGTH`), and ask every user to add a
      passkey from Admin.
- [ ] Keep the VPS patched (reboot pending for kernel updates), the backup
      timers green, and run the restore drill twice a year.
- [ ] Vercel and Sanity accounts: two-factor authentication on, and remove
      leavers the day they go.

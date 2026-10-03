# Record of processing activities (UK GDPR Art. 30)

Controller: the gallery (legal name per Site settings), St James's, London.
Data-protection lead: as named in Site settings. Reviewed October 2026.

| # | Activity | Data subjects | Data | Purpose | Lawful basis | Recipients | Retention | Security |
|---|---|---|---|---|---|---|---|---|
| 1 | Enquiries from the website and by email | Prospective clients | Name, email, phone, message, postal address for publication orders, consent evidence | Answer the enquiry; arrange viewing | Art. 6(1)(b) pre-contract; 6(1)(f) running the gallery | Resend (notification email), Vercel, Vultr | 3 years | Studio access, RLS, TLS |
| 2 | Appointment booking | Prospective and existing clients | Name, email, phone, requested time, notes | Arrange the appointment | 6(1)(b) | Resend (calendar invitation), Vercel, Vultr | 2 years after the appointment | as above |
| 3 | CRM — client relationship | Clients, collectors, institutions, trade | Contact details, interests, notes of contact, tags, purchase history | Manage relationships, offers | 6(1)(f) legitimate interest; 6(1)(b) where a contract exists | Vultr, Vercel | Active relationship + review after 5 years' inactivity | as above |
| 4 | Newsletter | Subscribers | Name, email, consent evidence, send and open records | Send news of exhibitions and works | 6(1)(a) consent (double opt-in); PECR reg. 22(3) soft opt-in for existing customers | Resend (USA), Vultr | Until withdrawal; suppression record kept; send records 3 years | Unsubscribe in every email; complaint suppression |
| 5 | Private offers | Selected clients | Name, email, works offered, page views (IP, browser) | Offer works privately | 6(1)(f) | Resend, Vercel, Vultr | Views 2 years; offer record 6 years with sale records | Tokenised links, optional password |
| 6 | Sales, purchases, consignments, shipping | Buyers, sellers, consignors | Name, address, invoice, payment, shipping and insurance details | Perform the contract; tax records | 6(1)(b); 6(1)(c) tax law | Accountants, shippers, insurers, HMRC | 6 years after the tax year | RLS: financials admin/accountant only |
| 7 | AML due diligence and sanctions screening | Clients in €10,000+ transactions; verified clients | Identity documents, proof of address, source of funds, risk rating, check results, screening results | Meet MLR 2017 and SAMLA 2018 | 6(1)(c) legal obligation; Art. 9/10 where special-category data appears in ID documents: DPA 2018 Sch. 1 para 12 (regulatory requirements) | HMRC, NCA, OFSI on demand; identity-verification provider if used; FCDO list (download only) | 5 years after the relationship ends | Admin-only RLS; private storage; access logged |
| 8 | Website security and operation | Visitors | IP address, browser headers, Turnstile token | Keep forms free of abuse; serve the site | 6(1)(f) | Cloudflare, Vercel | Not stored by the gallery beyond request logs (Vercel ≤ 30 days) | Headers, HTTPS |
| 9 | Website statistics | Visitors who consent | Aggregated, cookieless page views (self-hosted Plausible) | Understand use of the site | 6(1)(a) | Vultr (self-hosted) | Aggregated only | Gated behind consent |
| 10 | Advertising measurement (Meta pixel, only if enabled) | Visitors who consent | Pixel events, Meta cookies | Measure campaigns | 6(1)(a) | Meta (USA) | Per Meta policy | Gated behind consent |
| 11 | Staff accounts and audit | Staff | Email, role, login events, change log | Operate the studio securely | 6(1)(f); 6(1)(c) | Vercel, Vultr | Employment + 6 years for the change log | Passkeys, RLS, roles |
| 12 | Backups | All of the above | Encrypted database and file backups | Business continuity | 6(1)(f) | Vultr Object Storage (London) | 30 daily + 12 monthly | Encrypted at rest, restore drills |

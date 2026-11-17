# Processors and international transfers

| Processor | Role | Data | Location | Safeguard | DPA |
|---|---|---|---|---|---|
| Vultr (The Constant Company) | VPS and object storage: database, images, backups | Everything in the system | London (lhr1) | UK | Vultr DPA (in account) |
| Vercel | Hosting of website and studio; request logs | All data in transit; IP addresses in logs | Studio functions in London (lhr1); website functions USA; edge global | UK Extension to the EU-US DPF (Vercel is certified) / IDTA | Vercel DPA (dashboard → Legal) |
| Resend | Transactional and newsletter email; webhooks | Names, emails, email content, open/click events | USA | DPF / SCC + UK Addendum | Resend DPA (resend.com/legal/dpa) |
| Sanity | Website content (works, artists, events). No personal data except artist biographies, which are published | Public content only | EU / USA | Adequacy (EU) / DPF | Sanity DPA |
| Cloudflare (Turnstile) | Bot protection on forms | IP, browser signals | Global | DPF / SCC + UK Addendum | Cloudflare DPA (self-serve) |
| Meta (only if the pixel ID is set and the visitor consents) | Advertising measurement | Pixel events, cookies | USA | DPF; joint controller terms for pixel | Meta Business Tools terms |
| Anthropic (Claude API) | Reads photographs for staff: business cards scanned in the capture app (the card photo is deleted as soon as it has been read), work labels and purchase invoices photographed in the capture app, and the studio's AI drafts of catalogue text. Nothing is published or saved without a person checking it | Names, emails, phones and addresses on business cards and on invoices (sellers), photographs of works and labels, catalogue text | USA | SCC + UK Addendum (in Anthropic's DPA, part of its Commercial Terms) | Anthropic DPA (Console → Legal) |
| Google Maps Platform | Address autocomplete when staff type a contact's address in the capture app; naming the gallery, dealer or auction house a purchase was made at from the phone's location | The address text typed; the staff phone's location at the start of a purchase | USA / global | DPF / SCC + UK Addendum | Google Maps Platform terms and data processing terms (Cloud Console) |
| Plausible (self-hosted) | Website statistics | Aggregated, cookieless | London (own VPS) | — | — |
| Proton (Mail, Drive) | Staff email and documents | Correspondence, exports | Switzerland | UK adequacy regulations (Switzerland) | Proton terms |
| Accountants / solicitors | Professional advice | Transaction and client records as needed | UK | Independent controllers | Engagement letters |
| Shippers and insurers | Delivery of works | Buyer name, address, phone, value | Various | Independent controllers | Per shipment |

Google Fonts was removed from the site in October 2026: fonts are now served from
the gallery's own domain, so no visitor IP reaches Google.

Review this table whenever a service is added. Add the service to the Privacy
Notice "Who we share it with" section in the same change.

# Personal-data breach — the first 72 hours

A breach is any loss, theft, unauthorised access, disclosure or corruption of
personal data: a lost laptop or phone, an email sent to the wrong person, a
stolen password, a server compromise, a backup gone missing.

**Hour 0 — contain.** Change the affected passwords (Admin → users → reset),
revoke the session or device, take the system offline if it is still leaking.
Keep evidence; do not delete logs.

**Hour 1 — record.** Admin → Data protection → Breach register. Describe what
happened, which data, how many people, and the likely risk. Every breach is
recorded, reportable or not (Art. 33(5)).

**By hour 24 — assess the risk** to the people affected: identity documents or
financial data = high; names and emails alone = usually possible/unlikely.

**By hour 72 — report to the ICO** if the breach is *likely* to risk people's
rights and freedoms: ico.org.uk/breach or 0303 123 1113. Reporting late must be
explained. Tick "Reported to the ICO" in the register.

**High risk — tell the people affected** without undue delay, in plain words:
what happened, what data, what we have done, what they can do, whom to contact.
Tick "People affected notified".

**Afterwards.** Record the actions taken and what changed to stop a repeat.
Keep the register entry permanently.

Useful facts: the database and images are on the Vultr VPS in London
(encrypted backups in Vultr Object Storage); the website and studio run on
Vercel; newsletters go through Resend. The infra README has the restore steps.

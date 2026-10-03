# DPIA — anti-money-laundering due diligence and sanctions screening

Screening people against a government list and holding identity documents is
processing that can carry high risk (Art. 35), so this assessment is recorded.

**Processing.** (1) Collecting identity documents, proof of address and
source-of-funds information for clients in transactions of €10,000 or more.
(2) Fortnightly matching of verified clients' names against the FCDO UK
Sanctions List, with results stored per contact. (3) Reporting to HMRC, NCA or
OFSI when the law requires.

**Necessity and proportionality.** Required by MLR 2017 regs. 27–33 and 40, and
by SAMLA 2018; without it the gallery cannot lawfully trade above the threshold.
Only clients at or above the threshold are subjected to due diligence; only
verified clients are screened; the list is downloaded, not the clients sent
anywhere. Documents are stored in a private bucket readable only by admins.

**Risks.** False positives from name matching (common with transliterated
Japanese and Indian names) — *mitigation*: every match is reviewed by a person
before any action and recorded; no automated decision. Identity documents
exposed by a breach — *mitigation*: admin-only RLS, encrypted backups, access
logged, five-year deletion review. Special-category data visible on ID
documents (e.g. nationality, photographs) — *basis*: DPA 2018 Sch. 1 para 12,
limited to what the regulations require. Discrimination — *mitigation*: risk
ratings follow the written AML risk assessment, not nationality alone.

**Rights.** Individuals are told in the AML notice and Privacy Notice; access
requests are honoured except where tipping-off rules forbid; erasure is deferred
until the five-year hold ends, and the person is told so.

**Conclusion.** Residual risk is acceptable given the legal obligation and the
mitigations. Review annually or when a verification provider is adopted (a
hosted provider would hold the documents instead and needs its own DPA and
transfer assessment).

-- 0061_record_existing_consent
--
-- The gallery confirms that marketing consent was obtained from every existing
-- contact, and that contacts added from here on are captured compliantly.
-- Recorded here so the CRM reflects it.
--
-- Recorded with a date and a source, not just the boolean. UK GDPR Art. 7(1)
-- puts the burden on the controller to *demonstrate* consent, and
-- marketing_consent alone demonstrates nothing — a flag with no provenance is
-- indistinguishable from a flag someone set by accident. consent_date and
-- consent_source already exist on the table and were simply never populated.
--
-- Two deliberate choices about what is written:
--
--   * consent_date is the date this was RECORDED, not an invented date of
--     original consent. Back-dating to a plausible-looking date would be a
--     fabricated record, which is worse than an honest one. If the gallery
--     holds the original dates and sources (signup forms, FileMaker fields,
--     correspondence), those are better evidence and should replace these.
--
--   * consent_source names the basis in plain words, so an audit reads what
--     actually happened rather than an opaque code.
--
-- Nobody who has opted out is touched: do_not_mail and unsubscribed_at both
-- override a blanket confirmation, and the guard stays in the statement so a
-- re-run can never resurrect a withdrawal. Contacts that already carry their
-- own consent_date keep it.

update public.crm_contacts
   set marketing_consent = true,
       consent_date   = coalesce(consent_date, now()),
       consent_source = coalesce(
         consent_source,
         'Pre-existing client consent, confirmed by the gallery and recorded in '
         'bulk (migration 0061). Date is the date of recording, not of original '
         'consent.'
       )
 where do_not_mail is not true
   and unsubscribed_at is null;

notify pgrst, 'reload schema';

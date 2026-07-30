-- 0063_clean_consent_source
--
-- 0062 corrected the lawful basis for 843 contacts but wrote the superseded
-- import label into the live consent_source text, so the field read:
--
--   'Pre-existing client consent … Supersedes the import label
--    "address_xlsx_import_legitimate_interest" …'
--
-- Accurate, and a trap. Any check for "does this record claim legitimate
-- interest" — mine, a future audit script, or a person skimming the column —
-- matches on the quoted historical label and reports a contradiction that is
-- not there. A field describing the *current* basis should state only that.
--
-- The history is not lost by removing it: trg_log_crm_contacts already wrote
-- old and new to activity_log for all 843 rows, which is the proper evidence
-- of what the label was and when it changed. Verified present before this ran.

update public.crm_contacts
   set consent_source = 'Pre-existing client consent, confirmed by the gallery'
 where consent_source like 'Pre-existing client consent, confirmed by the gallery.%';

-- Bring 0061's wording into line, so one basis reads as one string. Its caveat
-- about the date belongs on consent_date, not restated per row.
update public.crm_contacts
   set consent_source = 'Pre-existing client consent, confirmed by the gallery'
 where consent_source like 'Pre-existing client consent, confirmed by the gallery and recorded in bulk%';

notify pgrst, 'reload schema';

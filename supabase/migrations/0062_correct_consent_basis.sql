-- 0062_correct_consent_basis
--
-- Correct the recorded lawful basis for 843 contacts.
--
-- The address import stamped consent_source = 'address_xlsx_import_legitimate_
-- interest', recording legitimate interest. 0061 then set marketing_consent on
-- every contact on the gallery's confirmation that consent had in fact been
-- obtained, and deliberately did not overwrite existing provenance — which left
-- those 843 rows self-contradictory: the flag said consent, the source said
-- legitimate interest. Under UK GDPR and PECR those are different bases, and a
-- record that asserts both states neither.
--
-- The gallery confirms the basis is consent. The source is corrected to say so,
-- and to name the label it replaces, so the history reads honestly rather than
-- looking like the import had recorded consent all along.
--
-- The change is additionally captured by trg_log_crm_contacts, which writes the
-- old and new values to activity_log — the per-row evidence that this label was
-- changed, when, and from what.
--
-- Only the import label is touched. Contacts whose source already described
-- consent, and the one recorded through the capture app, keep their own accurate
-- provenance.

update public.crm_contacts
   set consent_source =
         'Pre-existing client consent, confirmed by the gallery. Supersedes the '
         'import label "address_xlsx_import_legitimate_interest", which recorded '
         'the wrong lawful basis; see activity_log for the change.'
 where consent_source = 'address_xlsx_import_legitimate_interest'
   and do_not_mail is not true
   and unsubscribed_at is null;

notify pgrst, 'reload schema';

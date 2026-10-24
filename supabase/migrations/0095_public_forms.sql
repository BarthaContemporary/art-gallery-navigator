-- 0095_public_forms
-- The public website's forms (security review 2026-10, findings F11, F12,
-- F22, F23).
--
-- 1. contact_id_by_email(): how the website finds the contact behind an
--    address typed into a form. Exact and case-insensitive, on the existing
--    lower(email) index. The routes matched with ILIKE and the typed address
--    as the pattern, where "_" stands for any one character, so
--    john_smith@... could land on john.smith@...'s record (F23). When an
--    address is on more than one contact the oldest wins, so the answer is
--    always the same. Service role only: the website calls it from server
--    code.
--
-- 2. A newsletter confirmation asked for on behalf of a contact who already
--    existed is now kept as a pending entry inside consent_evidence
--    ("marketing_pending", holding only a hash of the link's token), never in
--    consent_confirm_token. That column marks a contact the website created
--    for a sign-up, and apply_retention() deletes such a contact after 30
--    days when it was never confirmed and nothing else holds it. Set on an
--    existing contact, it let anyone who knew the address have the whole
--    record deleted, opt-out included, by signing it up and waiting. The
--    same holds for a sign-up that went on to send an enquiry or book a
--    visit: the enquiry or appointment holds it only until the retention
--    job deletes that too, and the same run then deleted the contact as an
--    abandoned sign-up. The tokens the old code left on such contacts move
--    across here, so the links already emailed keep working; a request
--    whose link has already expired (30 days) is dropped instead, as the
--    website now does (apps/web/src/lib/optin-evidence.ts).
--
-- Idempotent: the move only touches rows that still carry such a token.

create or replace function public.contact_id_by_email(_email text)
returns uuid
language sql
stable
set search_path = public
as $$
  select c.id
    from public.crm_contacts c
   where btrim(coalesce(_email, '')) <> ''
     and lower(c.email) = lower(btrim(_email))
   order by c.created_at, c.id
   limit 1;
$$;
revoke all on function public.contact_id_by_email(text) from public, anon, authenticated;
grant execute on function public.contact_id_by_email(text) to service_role;
comment on function public.contact_id_by_email(text) is
  'The contact with exactly this email (case-insensitive), oldest first. Public website forms; service role only.';

-- A contact the website created for a sign-up that was never confirmed has
-- the website's source, no consent date, no opt-out and no consent. Any other
-- contact carrying a token existed before somebody typed its address into
-- the sign-up box, and a sign-up with an enquiry or an appointment has become
-- a client relationship: the token leaves the column. Where the old code
-- wrote that sign-up's unconfirmed evidence over "marketing", the evidence
-- goes with the token rather than standing as the contact's consent record;
-- any other "marketing" entry (a confirmed one, the legacy-import note)
-- stays. A request still within its 30 days becomes the pending entry; an
-- expired one, whose link can never be confirmed, is not kept.
update public.crm_contacts c
   set consent_evidence =
         case
           when c.consent_evidence -> 'marketing' ->> 'form' = 'newsletter'
            and c.consent_evidence -> 'marketing' ->> 'confirmed_at' is null
           then c.consent_evidence - 'marketing'
           else coalesce(c.consent_evidence, '{}'::jsonb)
         end
         || case
              when c.consent_confirm_sent_at > now() - interval '30 days'
              then jsonb_build_object(
                     'marketing_pending',
                     jsonb_build_object('at', c.consent_confirm_sent_at, 'form', 'newsletter')
                       || case
                            when c.consent_evidence -> 'marketing' ->> 'form' = 'newsletter'
                             and c.consent_evidence -> 'marketing' ->> 'confirmed_at' is null
                            then c.consent_evidence -> 'marketing'
                            else '{}'::jsonb
                          end
                       || jsonb_build_object(
                            'token_hash', encode(sha256(convert_to(c.consent_confirm_token, 'UTF8')), 'hex')))
              else '{}'::jsonb
            end,
       consent_confirm_token = null,
       consent_confirm_sent_at = null
 where c.consent_confirm_token is not null
   and (not (c.consent_source is not distinct from 'website_newsletter'
             and c.consent_date is null
             and c.unsubscribed_at is null
             and not c.marketing_consent)
        or exists (select 1 from public.enquiries e where e.contact_id = c.id)
        or exists (select 1 from public.appointments a where a.contact_id = c.id));

notify pgrst, 'reload schema';

-- 0059_dynamic_crm_lists
--
-- Contact lists could only ever be hand-curated: crm_lists had no notion of a
-- saved view, so a list like "All" was a snapshot that started going stale the
-- moment the next contact was added.
--
-- This gives crm_lists the same two columns piece_lists has had all along, so
-- the two kinds of list behave alike:
--
--   is_dynamic    membership is computed, not stored
--   filter_rules  the query, as jsonb; {} means "every contact"
--
-- A dynamic list keeps no rows in crm_list_members. Everything that reads
-- membership goes through lib/crm-list-members.ts, for the reason spelled out
-- in lib/list-members.ts: the same resolution logic copied across eight route
-- handlers is exactly how the inventory live-list bug happened.
--
-- Consent is unaffected. The campaign sender filters marketing_consent,
-- do_not_mail and unsubscribed_at per recipient at send time, so a list that
-- contains everyone still cannot mail someone who has not opted in.

alter table public.crm_lists
  add column if not exists is_dynamic boolean not null default false,
  add column if not exists filter_rules jsonb;

comment on column public.crm_lists.is_dynamic is
  'When true, membership is resolved live from filter_rules and crm_list_members '
  'holds no rows for this list.';

comment on column public.crm_lists.filter_rules is
  'Saved-view query for a dynamic list. An empty object means every contact. '
  'Recognised keys: contact_type, country, marketing_consent.';

-- The "All" list the dealer created by hand: make it the everyone view, and
-- drop any rows that were added to it while it was static so the two notions
-- of membership cannot disagree.
update public.crm_lists
   set is_dynamic = true,
       filter_rules = '{}'::jsonb
 where lower(btrim(name)) = 'all';

delete from public.crm_list_members m
 using public.crm_lists l
 where m.list_id = l.id
   and l.is_dynamic;

notify pgrst, 'reload schema';

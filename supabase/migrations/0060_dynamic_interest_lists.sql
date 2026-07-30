-- 0060_dynamic_interest_lists
--
-- Make the areas-of-interest lists live, so they stop drifting from the
-- contacts they describe.
--
-- These eleven lists (Japanese metalwork, Indian sculpture, …) were kept in
-- step by hand: saving a contact wrote its interests to custom_fields.interests
-- AND mirrored them into crm_list_members. Two copies of one fact, kept aligned
-- by remembering to. Anything that changed a contact's interests without going
-- through that route — an import, a SQL fix, a future surface — left the lists
-- wrong with nothing to notice it.
--
-- The interests already live on the contact, so there is nothing to migrate:
-- custom_fields.interests is complete and identical to the stored membership
-- for all eleven lists, verified against production before writing this. The
-- mirror is redundant, so it goes, and membership is derived from the contact.
--
-- The assertion below is the safety net: if any list's derived membership does
-- not match what is stored, the whole migration raises and rolls back rather
-- than deleting rows it cannot reproduce.

-- ---------------------------------------------------------------------------
-- 1. Refuse to run if deriving membership would change it.
-- ---------------------------------------------------------------------------
do $$
declare
  _bad text;
begin
  select string_agg(format('%s (stored %s, derived %s)', name, stored, derived), '; ')
    into _bad
    from (
      select a.name,
             (select count(*) from public.crm_list_members m where m.list_id = a.list_id) as stored,
             (select count(*) from public.crm_contacts c
               where c.custom_fields->'interests' @> to_jsonb(a.name))                    as derived
        from public.crm_interest_areas a
       where a.list_id is not null
    ) t
   where stored <> derived;

  if _bad is not null then
    raise exception
      'Interest lists would change if derived from contacts, refusing: %', _bad;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Convert each interest list to a live view of its area.
--
--    filter_rules.interest is matched against custom_fields.interests, the
--    array the contact editor already writes.
-- ---------------------------------------------------------------------------
update public.crm_lists l
   set is_dynamic  = true,
       filter_rules = jsonb_build_object('interest', a.name)
  from public.crm_interest_areas a
 where a.list_id = l.id;

-- ---------------------------------------------------------------------------
-- 3. Drop the mirror. Membership is computed from here on, and leaving stale
--    rows behind would give two answers to the same question.
-- ---------------------------------------------------------------------------
delete from public.crm_list_members m
 using public.crm_lists l
 where m.list_id = l.id
   and l.is_dynamic;

-- ---------------------------------------------------------------------------
-- 4. Index the containment lookup. Every interest list now runs it on read.
-- ---------------------------------------------------------------------------
create index if not exists idx_crm_contacts_interests
  on public.crm_contacts using gin ((custom_fields -> 'interests'));

notify pgrst, 'reload schema';

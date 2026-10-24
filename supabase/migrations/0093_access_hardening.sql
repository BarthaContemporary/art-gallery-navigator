-- 0093_access_hardening
-- Database access fixes from the security review of 2026-10-24 (findings F5,
-- F10, F13, F24, and the erase_contact() problem the verifiers disputed).
--
--   1. activity_log: the accountant reads only the stock-book entries (F5).
--      Offer passwords and opt-in link tokens are no longer copied into the
--      log, and the copies already there are blanked.
--   2. erase_contact(): accepts the service role the studio calls it with,
--      writes nothing about the person back into the log while it runs, and
--      scrubs their address from email_events.
--   3. Stock numbers never wrap past 9999, absurd years are refused, and the
--      purge jobs never use a grace shorter than a sane minimum (F10).
--   4. Data-protection helpers are service-role only (F13).
--   5. The accountant's storage access to piece-documents is narrowed to
--      invoice files and shipment files (F24).
--   6. SECURITY DEFINER functions: nobody gets EXECUTE through PUBLIC any
--      more, signed-in users keep only what the apps call with their own
--      session, and new functions stop granting PUBLIC by default (F10).
--
-- Idempotent; safe to re-run.

-- ===========================================================================
-- 1. The change log
-- ===========================================================================

-- log_activity() as in 0056, plus two things:
--   • values that open something on their own (an offer's viewing password,
--     a newsletter confirmation token) are written as "[redacted]": the entry
--     still says the value was set, changed or cleared, never what it was;
--   • erase_contact() names the contact it is erasing for its own
--     transaction, and that contact's row is not written back into the log.
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _row       jsonb;
  _changes   jsonb;
  _entity_id uuid;
  _secrets   text[];
  _k         text;
begin
  if coalesce(current_setting('jvb.ledger_move', true), '0') = '1' then
    return coalesce(new, old);    -- one "moved register" entry is written instead
  end if;

  _row := coalesce(to_jsonb(new), to_jsonb(old));
  -- pieces/crm_contacts/offers key on id; piece_financials keys on piece_id
  _entity_id := coalesce((_row ->> 'id')::uuid, (_row ->> 'piece_id')::uuid);

  if tg_table_name = 'crm_contacts'
     and _entity_id::text = coalesce(current_setting('jvb.erasing_contact', true), '') then
    return coalesce(new, old);    -- being erased: nothing about them goes back in
  end if;

  _secrets := case tg_table_name
    when 'offers'       then array['access_password']
    when 'crm_contacts' then array['consent_confirm_token']
    else array[]::text[]
  end;

  if tg_op in ('INSERT', 'DELETE') then
    foreach _k in array _secrets loop
      if _row ? _k and _row -> _k <> 'null'::jsonb then
        _row := jsonb_set(_row, array[_k], '"[redacted]"');
      end if;
    end loop;
    _changes := jsonb_build_object(case tg_op when 'INSERT' then 'new' else 'old' end, _row);
  else
    -- Diff limited to changed keys; noise columns excluded.
    select jsonb_object_agg(n.key,
             case when n.key = any (_secrets) then
               jsonb_build_object(
                 'old', case when o.value = 'null'::jsonb then null else '"[redacted]"'::jsonb end,
                 'new', case when n.value = 'null'::jsonb then null else '"[redacted]"'::jsonb end)
             else jsonb_build_object('old', o.value, 'new', n.value) end)
      into _changes
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
     where n.value is distinct from o.value
       and n.key not in ('updated_at', 'updated_by', 'search_vector');

    if _changes is null then
      return new;  -- nothing meaningful changed
    end if;
  end if;

  insert into public.activity_log (actor_id, entity_type, entity_id, action, changes)
  values (auth.uid(), tg_table_name, _entity_id, tg_op, _changes);

  return coalesce(new, old);
end;
$$;

-- The copies already in the log, in both shapes the trigger has written: the
-- whole row under "new"/"old" (created, deleted) and {old, new} per changed
-- column (edited).
update public.activity_log l
   set changes = (
     select jsonb_object_agg(e.key, case
       when e.key in ('new', 'old') and jsonb_typeof(e.value) = 'object'
            and e.value ? s.col and e.value -> s.col <> 'null'::jsonb
         then jsonb_set(e.value, array[s.col], '"[redacted]"')
       when e.key = s.col and jsonb_typeof(e.value) = 'object'
         then jsonb_build_object(
                'old', case when coalesce(e.value -> 'old', 'null') = 'null'::jsonb then null else '"[redacted]"'::jsonb end,
                'new', case when coalesce(e.value -> 'new', 'null') = 'null'::jsonb then null else '"[redacted]"'::jsonb end)
       else e.value end)
     from jsonb_each(l.changes) e)
  from (values ('offers', 'access_password'), ('crm_contacts', 'consent_confirm_token')) s (entity_type, col)
 where l.entity_type = s.entity_type
   and jsonb_typeof(l.changes) = 'object'
   and (l.changes ? s.col or l.changes -> 'new' ? s.col or l.changes -> 'old' ? s.col);

-- F5: the accountant audits the stock book, not the CRM or the offers. These
-- are every entity_type the stock tables and the register move write.
drop policy if exists accountant_select on public.activity_log;
create policy accountant_select on public.activity_log
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'accountant')
    and entity_type in ('pieces', 'external_pieces', 'piece_financials')
  );

-- ===========================================================================
-- 2. Erasure
-- ===========================================================================
create or replace function public.erase_contact(_contact uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _holds  text[];
  _email  text;
  _caller text;
  _result jsonb;
begin
  -- The studio's server action checks the admin role, then calls this with
  -- the service client. PostgREST passes the role in request.jwt.claims; the
  -- old check read only the legacy per-claim setting (gone since PostgREST
  -- 10), so it refused every erasure the studio asked for. Signed-in
  -- sessions no longer have EXECUTE at all (section 6); the admin test stays
  -- as a second line should that grant ever come back.
  _caller := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''));
  if _caller is distinct from 'service_role' and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only an admin can erase a contact';
  end if;
  if not exists (select 1 from public.crm_contacts where id = _contact) then
    return jsonb_build_object('mode', 'missing');
  end if;

  _holds := public.contact_legal_holds(_contact);
  select nullif(lower(btrim(email)), '') into _email from public.crm_contacts where id = _contact;

  -- Nothing written below goes back into the change log (log_activity()).
  perform set_config('jvb.erasing_contact', _contact::text, true);

  -- Delivery events keep their type and date but lose the address and the
  -- rest of the provider's payload. Done before the recipient rows go, while
  -- they still link the events to this contact. Webhook events for offer
  -- emails carry no recipient link, so the address itself is matched too
  -- (as a whole address, never as part of a longer one).
  update public.email_events ev
     set payload = jsonb_build_object('erased', true)
   where ev.campaign_recipient_id in (select r.id from public.crm_campaign_recipients r where r.contact_id = _contact)
      or ev.offer_recipient_id in (select r.id from public.offer_recipients r where r.contact_id = _contact)
      or (ev.payload -> 'data' ->> 'email_id') in (
           select r.resend_email_id from public.crm_campaign_recipients r
            where r.contact_id = _contact and r.resend_email_id is not null
           union all
           select r.resend_email_id from public.offer_recipients r
            where r.contact_id = _contact and r.resend_email_id is not null)
      or (_email is not null
          and strpos(lower(ev.payload::text), _email) > 0
          and (jsonb_path_exists(lower(ev.payload::text)::jsonb, '$.** ? (@ == $e)', jsonb_build_object('e', _email))
               or exists (select 1
                            from regexp_matches(lower(ev.payload::text), '[a-z0-9._%+''-]+@[a-z0-9.-]+', 'g') m
                           where rtrim(m[1], '.') = _email)));

  -- Everything that is personal and not under hold goes, in either mode.
  delete from public.crm_interactions where contact_id = _contact;
  delete from public.crm_list_members where contact_id = _contact;
  delete from public.crm_campaign_recipients where contact_id = _contact;
  delete from public.unsubscribe_tokens where contact_id = _contact;
  delete from public.offer_recipients where contact_id = _contact;
  update public.appointments set contact_id = null, name = 'Erased', email = null, phone = null, notes = null where contact_id = _contact;
  update public.enquiries set contact_id = null, message = '[erased at the data subject''s request]' where contact_id = _contact;

  if coalesce(array_length(_holds, 1), 0) = 0 then
    delete from public.crm_contacts where id = _contact;
    _result := jsonb_build_object('mode', 'deleted', 'holds', '[]'::jsonb);
  else
    -- Under hold: pseudonymise. The row stays so the retained accounting and
    -- AML records keep their reference; nothing identifying remains on it.
    update public.crm_contacts set
      first_name = 'Erased contact',
      last_name = left(_contact::text, 8),
      salutation = null,
      email = null, phone = null,
      address_line1 = null, address_line2 = null, city = null, postcode = null, country = null,
      instagram_handle = null, whatsapp_number = null, line_id = null, wechat_id = null,
      tags = '{}', interested_regions = '{}', custom_fields = '{}'::jsonb, notes = null,
      marketing_consent = false, consent_evidence = null, consent_confirm_token = null,
      do_not_mail = true, unsubscribed_at = coalesce(unsubscribed_at, now()),
      erased_at = now()
    where id = _contact;
    _result := jsonb_build_object('mode', 'anonymised', 'holds', to_jsonb(_holds));
  end if;

  -- And what was logged about them before: the full row when they were
  -- added, and every edit since.
  delete from public.activity_log where entity_type = 'crm_contacts' and entity_id = _contact;

  perform set_config('jvb.erasing_contact', '', true);
  return _result;
end;
$$;

-- ===========================================================================
-- 3. Stock numbers and the purge jobs
-- ===========================================================================

-- As in 0004, with two guards: a year that cannot be a cataloguing year
-- (before 1900, or more than one ahead) is refused rather than opening a stray
-- series, and the sequence keeps all its digits past 9999 — lpad() used to cut
-- "10000" back to "1000", an existing number, so every new record failed on
-- the unique stock number from then on (and the failed insert rolled the
-- counter back, so it stayed stuck).
create or replace function public.next_stock_number(_year int)
returns text
language plpgsql
security definer            -- staff insert pieces but have no direct grant/policy on the counters table
set search_path = public
as $$
declare
  _seq int;
begin
  if _year is null or _year < 1900 or _year > extract(year from now())::int + 1 then
    raise exception 'Stock number year % is out of range', _year using errcode = '22023';
  end if;

  -- Serialize allocation per year for the duration of this transaction only.
  perform pg_advisory_xact_lock(hashtext('stock_number' || _year::text));

  insert into public.stock_number_counters as c (year, last_seq)
  values (_year, 1)
  on conflict (year)
  do update set last_seq = c.last_seq + 1
  returning last_seq into _seq;

  return format('%s-%s', _year, lpad(_seq::text, greatest(4, length(_seq::text)), '0'));
end;
$$;

-- The X- series from 0056, with the same guards.
create or replace function public.next_external_stock_number(_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _seq int;
begin
  if _year is null or _year < 1900 or _year > extract(year from now())::int + 1 then
    raise exception 'Stock number year % is out of range', _year using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('external_stock_number' || _year::text));

  insert into public.external_stock_number_counters as c (year, last_seq)
  values (_year, 1)
  on conflict (year)
  do update set last_seq = c.last_seq + 1
  returning last_seq into _seq;

  return format('X-%s-%s', _year, lpad(_seq::text, greatest(4, length(_seq::text)), '0'));
end;
$$;

-- As in 0056, except that the grace is never under an hour (the cron passes
-- two): a negative or zero grace would delete a "New record" draft while
-- someone is still about to fill it in.
create or replace function public.purge_blank_draft_pieces(grace interval default '2 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _blank constant text := $pred$
        p.deleted_at is null
    and p.created_at < now() - $1
    -- descriptive / cataloguing fields all empty
    and p.title is null
    and p.maker_id is null
    and p.category_id is null
    and p.location_id is null
    and p.year is null
    and p.medium is null
    and p.period is null
    and p.origin_region is null
    and p.description is null
    and p.condition_report is null
    and p.signature_inscription is null
    and p.box_type is null and p.box_notes is null
    and p.dimensions_display is null
    and p.height_cm is null and p.width_cm is null and p.depth_cm is null
    and p.length_cm is null and p.diameter_cm is null and p.weight_g is null
    and coalesce(p.comments, '') = ''
    and coalesce(p.source_note, '') = ''
    and coalesce(p.purchased_from, '') = ''
    and coalesce(p.sold_to, '') = ''
    and coalesce(p.shares_note, '') = ''
    and coalesce(p.consignment_details, '') = ''
    and p.consignment_share_pct is null
    and p.sale_handled_by_jvb is null
    and (p.publications is null or p.publications = '[]'::jsonb)
    and (p.exhibitions is null or p.exhibitions = '[]'::jsonb)
    and coalesce(array_length(p.tags, 1), 0) = 0
    and p.web_visible = false
    -- no related records
    and not exists (select 1 from public.piece_images   pi where pi.piece_id = p.id)
    and not exists (select 1 from public.document_pieces dp where dp.piece_id = p.id)
    and not exists (select 1 from public.piece_shipments ps where ps.piece_id = p.id)
    -- no financial data entered
    and not exists (
      select 1 from public.piece_financials f
      where f.piece_id = p.id
        and (f.purchase_cost is not null
             or f.purchase_date is not null
             or f.marked_price_gbp is not null
             or f.sold_price is not null
             or f.sold_date is not null
             or f.seller_contact_id is not null
             or f.buyer_contact_id is not null
             or f.consignment_id is not null)
    )
  $pred$;
  _tbl   text;
  _n     integer;
  _total integer := 0;
begin
  grace := greatest(coalesce(grace, interval '2 hours'), interval '1 hour');
  foreach _tbl in array array['pieces', 'external_pieces'] loop
    execute format(
      'with del as (delete from public.%I p where %s returning 1) select count(*) from del',
      _tbl, _blank)
      using grace
      into _n;
    _total := _total + _n;
  end loop;
  return _total;
end;
$$;

-- As in 0041, with a grace of at least a day (the cron passes two).
create or replace function public.purge_empty_shipments(grace interval default '2 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  grace := greatest(coalesce(grace, interval '2 days'), interval '1 day');
  with del as (
    delete from public.shipments s
    where s.created_at < now() - grace
      -- no details entered
      and s.shipment_date is null
      and coalesce(s.reference, '') = ''
      and coalesce(s.notes, '') = ''
      and coalesce(s.destination_country, '') = ''
      -- no related records
      and not exists (select 1 from public.piece_shipments ps where ps.shipment_id = s.id)
      and not exists (select 1 from public.shipment_documents sd where sd.shipment_id = s.id)
    returning 1
  )
  select count(*) into n from del;
  return n;
end;
$$;

-- ===========================================================================
-- 4. Data-protection helpers (F13)
-- ===========================================================================
-- Admin → Data protection reads the review queue with the service client. The
-- view ran with its owner's rights and kept the default grant to every
-- signed-in user, so the accountant could read contact names and emails
-- through it. It now runs with the reader's rights and only the service role
-- may read it.
alter view public.vw_contacts_for_review set (security_invoker = true);
revoke all on public.vw_contacts_for_review from public, anon, authenticated;
grant select on public.vw_contacts_for_review to service_role;

-- ===========================================================================
-- 5. Accountant storage access (F24)
-- ===========================================================================
-- The accountant read every object in piece-documents; the row policies that
-- hide correspondence, certificates and condition reports from them do not
-- reach storage. Now: invoice files (0052's is_invoice_object) and the files
-- of import/export shipments (filed by the studio under shipments/<id>/, and
-- recognised here by their shipment_documents row, so a stray object under
-- that prefix is not covered).
create index if not exists idx_piece_documents_storage_path on public.piece_documents (storage_path);
create index if not exists idx_shipment_documents_storage_path on public.shipment_documents (storage_path);

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present, skipping storage.objects policies';
    return;
  end if;

  execute 'drop policy if exists piece_documents_accountant_read on storage.objects';
  execute $f$
    create policy piece_documents_accountant_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'piece-documents'
        and public.has_role(auth.uid(), 'accountant')
        and (
          public.is_invoice_object(name)
          or exists (select 1 from public.shipment_documents sd where sd.storage_path = objects.name)
        )
      )
  $f$;
end;
$$;

-- ===========================================================================
-- 6. Who may execute SECURITY DEFINER functions (F10)
-- ===========================================================================
-- 0057 revoked EXECUTE from anon only, but every function is also executable
-- by PUBLIC, which anon is part of. So with the public anon key anyone could
-- call next_stock_number() and the purge jobs.
--
-- The apps call these with a signed-in user's own session (nothing is called
-- with the anon key; the website's server routes use the service role):
--   pieces_search, crm_contacts_search  (SECURITY INVOKER, unaffected)
--   move_piece_ledger                   (checks for an admin itself)
-- and the storage and table policies, which run as the signed-in user, use
--   has_role, has_any_role, is_invoice_object.
-- Everything else is called by the service role (cron, sync, the studio's
-- server actions) or from inside other SECURITY DEFINER functions and
-- triggers, which run as the owner and need no grant.

-- Nothing through PUBLIC or anon; the service role keeps everything. Trigger
-- functions cannot be called directly and extension functions keep their
-- own grants.
do $$
declare
  _f regprocedure;
begin
  for _f in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prokind = 'f'
       and p.prorettype <> 'trigger'::regtype
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', _f);
    execute format('grant execute on function %s to service_role', _f);
  end loop;
end;
$$;

-- Signed-in users: only the four above. By name rather than signature, so an
-- overload or a changed argument list is covered too.
do $$
declare
  _f regprocedure;
begin
  for _f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'next_stock_number', 'next_external_stock_number',   -- the stock-number triggers
         'purge_blank_draft_pieces', 'purge_deleted_pieces',   -- the daily cron
         'purge_empty_shipments',
         'queue_list_sync',                                    -- the list sync triggers
         'contact_legal_holds', 'contacts_with_weak_marketing_basis',
         'erase_contact', 'apply_retention',                   -- studio server actions, cron
         'claim_sync_outbox', 'rate_limit_hit')                -- sync route, public forms
  loop
    execute format('revoke execute on function %s from authenticated', _f);
  end loop;

  for _f in
    select p.oid::regprocedure
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('has_role', 'has_any_role', 'is_invoice_object', 'move_piece_ledger')
  loop
    execute format('grant execute on function %s to authenticated', _f);
  end loop;
end;
$$;

-- New functions are not executable by PUBLIC. Postgres only lets the PUBLIC
-- default be removed for all schemas at once, so this is per creating role
-- rather than per schema; both roles that apply migrations are covered, as in
-- 0057. Supabase's own per-schema defaults still grant new functions in
-- public to authenticated and service_role (0057 removed anon), so a new RPC
-- keeps working for signed-in users; a new SECURITY DEFINER function that
-- only the server needs should still revoke authenticated itself.
do $$
declare
  r text;
begin
  foreach r in array array['postgres', 'supabase_admin']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('alter default privileges for role %I revoke execute on functions from public', r);
    end if;
  end loop;
end;
$$;

-- A standing check beside vw_anon_exposure: every SECURITY DEFINER function
-- in public that a caller with the anon key or a user's session can run.
-- anon_can_execute should never be true; the authenticated rows should be
-- exactly has_role, has_any_role, is_invoice_object and move_piece_ledger
-- (plus anything a later migration deliberately adds).
create or replace view public.vw_function_exposure as
select
  p.oid::regprocedure::text                                    as function_signature,
  has_function_privilege('anon', p.oid, 'execute')             as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute')    as authenticated_can_execute,
  exists (
    select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  )                                                            as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and p.prokind = 'f'
  and p.prorettype <> 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));

comment on view public.vw_function_exposure is
  'SECURITY DEFINER functions in public callable with the anon key or a signed-in '
  'session. anon_can_execute should never be true; authenticated should be only '
  'has_role, has_any_role, is_invoice_object and move_piece_ledger.';

revoke all on public.vw_function_exposure from public, anon, authenticated;
grant select on public.vw_function_exposure to service_role;

notify pgrst, 'reload schema';

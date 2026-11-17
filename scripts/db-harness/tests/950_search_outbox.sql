-- 0100: the search outbox notes every change that alters a search document
-- and nothing else, wakes the studio once per committing transaction, never
-- blocks a save, is closed to everyone but the service role (and gives that
-- role only what apps/studio/src/lib/opensearch/indexer.ts uses), hands out
-- claims the way the drain needs them, and is purged by apply_retention().
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset
select t.make_user('norole@example.com') as norole_id \gset

-- Helpers, run as the superuser between steps (staff may not read the outbox).
create function pg_temp.pending(_type text, _id uuid) returns bigint language sql as
  $$ select count(*) from public.search_outbox where entity_type = _type and entity_id = _id and claimed_at is null $$;
create function pg_temp.wakeups() returns bigint language sql as
  $$ select count(*) from net.requests where url like '%/api/sync/search' $$;
-- A fresh "transaction" for the wake-up guard (the whole test is one).
create function pg_temp.clear() returns void language sql as
  $$ delete from public.search_outbox; delete from net.requests; select set_config('jvb.search_pushed', '', true); $$;
create function pg_temp.expect(_what text, _type text, _id uuid, _n bigint) returns void language plpgsql as $$
begin
  if pg_temp.pending(_type, _id) <> _n then
    raise exception '%: expected % pending % row(s), found %', _what, _n, _type, pg_temp.pending(_type, _id);
  end if;
end $$;
create function pg_temp.expect_total(_what text, _n bigint) returns void language plpgsql as $$
begin
  if (select count(*) from public.search_outbox) <> _n then
    raise exception '%: expected % outbox row(s) in all, found %: %', _what, _n,
      (select count(*) from public.search_outbox),
      (select string_agg(entity_type || ' ' || entity_id, ', ') from public.search_outbox);
  end if;
end $$;
create function pg_temp.expect_wakeups(_what text, _n bigint) returns void language plpgsql as $$
begin
  if pg_temp.wakeups() <> _n then
    raise exception '%: expected % search wake-up(s), found %', _what, _n, pg_temp.wakeups();
  end if;
end $$;

-- ===========================================================================
-- Privileges
-- ===========================================================================
do $$
declare
  _r   text;
  _p   text;
  _tbl text;
  _fn  text;
begin
  foreach _tbl in array array['public.search_outbox', 'public.search_state']
  loop
    if not (select relrowsecurity from pg_class where oid = _tbl::regclass) then
      raise exception 'row level security is off on %', _tbl;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = split_part(_tbl, '.', 2)) then
      raise exception '% has a policy; it should have none', _tbl;
    end if;
    foreach _r in array array['anon', 'authenticated']
    loop
      foreach _p in array array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']
      loop
        if has_table_privilege(_r, _tbl, _p) then
          raise exception '% has % on %', _r, _p, _tbl;
        end if;
      end loop;
      if has_any_column_privilege(_r, _tbl, 'select') or has_any_column_privilege(_r, _tbl, 'update') then
        raise exception '% has a column privilege on %', _r, _tbl;
      end if;
    end loop;
  end loop;
  if exists (select 1 from information_schema.table_privileges
              where table_schema = 'public' and table_name in ('search_outbox', 'search_state') and grantee = 'PUBLIC') then
    raise exception 'PUBLIC has a privilege on the search tables';
  end if;
  if has_sequence_privilege('authenticated', pg_get_serial_sequence('public.search_outbox', 'id'), 'usage')
     or has_sequence_privilege('anon', pg_get_serial_sequence('public.search_outbox', 'id'), 'usage') then
    raise exception 'the outbox id sequence is open to signed-in or anonymous users';
  end if;

  -- The service role: what the drain, the reconcile and the Admin page use, nothing more.
  if not has_table_privilege('service_role', 'public.search_outbox', 'select')
     or not has_table_privilege('service_role', 'public.search_outbox', 'delete')
     or not has_column_privilege('service_role', 'public.search_outbox', 'claimed_at', 'update') then
    raise exception 'the service role cannot drain search_outbox';
  end if;
  if has_table_privilege('service_role', 'public.search_outbox', 'insert')
     or has_table_privilege('service_role', 'public.search_outbox', 'truncate')
     or has_column_privilege('service_role', 'public.search_outbox', 'entity_id', 'update') then
    raise exception 'the service role has more on search_outbox than the drain needs';
  end if;
  if not has_table_privilege('service_role', 'public.search_state', 'select')
     or not has_table_privilege('service_role', 'public.search_state', 'insert')
     or not has_table_privilege('service_role', 'public.search_state', 'update') then
    raise exception 'the service role cannot record a search run';
  end if;
  if has_table_privilege('service_role', 'public.search_state', 'delete')
     or has_table_privilege('service_role', 'public.search_state', 'truncate') then
    raise exception 'the service role has more on search_state than the studio needs';
  end if;

  -- Functions: nobody but the service role; PUBLIC not at all.
  foreach _fn in array array['public.claim_search_outbox(integer)', 'public.search_clock_ms()',
                             'public.enqueue_search()', 'public.push_search_outbox()', 'public.apply_retention()']
  loop
    if has_function_privilege('anon', _fn, 'execute') or has_function_privilege('authenticated', _fn, 'execute') then
      raise exception 'signed-in or anonymous users can execute %', _fn;
    end if;
    if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = _fn::regprocedure and a.grantee = 0) then
      raise exception 'PUBLIC can execute %', _fn;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.claim_search_outbox(integer)', 'execute')
     or not has_function_privilege('service_role', 'public.search_clock_ms()', 'execute') then
    raise exception 'the service role cannot claim or read the clock';
  end if;
  -- Trigger functions are SECURITY DEFINER with a fixed search_path; the
  -- functions the studio calls run as the caller.
  if exists (select 1 from pg_proc where oid in ('public.enqueue_search()'::regprocedure, 'public.push_search_outbox()'::regprocedure)
              and (not prosecdef or not exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))) then
    raise exception 'a search trigger function is not SECURITY DEFINER with a search_path';
  end if;
  if exists (select 1 from pg_proc where oid in ('public.claim_search_outbox(integer)'::regprocedure, 'public.search_clock_ms()'::regprocedure)
              and (prosecdef or not exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))) then
    raise exception 'claim_search_outbox and search_clock_ms should run as the caller, with a search_path';
  end if;
end $$;

-- Each signed-in role, and anon: nothing to read, nothing to call.
create function pg_temp.refused(_who text) returns void language plpgsql as $$
begin
  if t.visible('public.search_outbox') <> -1 then raise exception '% can read search_outbox', _who; end if;
  if t.visible('public.search_state') <> -1 then raise exception '% can read search_state', _who; end if;
  begin perform public.claim_search_outbox(10); raise exception '% could claim', _who;
  exception when insufficient_privilege then null; end;
  begin perform public.search_clock_ms(); raise exception '% could read the search clock', _who;
  exception when insufficient_privilege then null; end;
  begin perform public.apply_retention(); raise exception '% could run the retention job', _who;
  exception when insufficient_privilege then null; end;
  begin insert into public.search_outbox (entity_type, entity_id) values ('work', gen_random_uuid());
    raise exception '% could queue a row', _who;
  exception when insufficient_privilege then null; end;
  begin insert into public.search_state (kind, last_result) values ('drain', 'forged');
    raise exception '% could write search_state', _who;
  exception when insufficient_privilege then null; end;
  begin delete from public.search_outbox; raise exception '% could delete outbox rows', _who;
  exception when insufficient_privilege then null; end;
end $$;
grant execute on function pg_temp.refused(text) to anon, authenticated;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.refused('anon');
reset role;
select t.claims(:'staff_id');
set local role authenticated;
select pg_temp.refused('staff');
reset role;
select t.claims(:'acc_id');
set local role authenticated;
select pg_temp.refused('the accountant');
reset role;
select t.claims(:'admin_id');
set local role authenticated;
select pg_temp.refused('an admin''s session');
reset role;
select t.claims(:'norole_id');
set local role authenticated;
select pg_temp.refused('a user with no role');
reset role;

-- The standing checks gain nothing from 0100.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  if exists (select 1 from public.vw_function_exposure
              where function_signature ~ '^(enqueue_search|push_search_outbox|claim_search_outbox|search_clock_ms|apply_retention)\(') then
    raise exception 'vw_function_exposure lists a function of 0100: %',
      (select string_agg(function_signature, ', ') from public.vw_function_exposure
        where function_signature ~ '^(enqueue_search|push_search_outbox|claim_search_outbox|search_clock_ms|apply_retention)\(');
  end if;
  if exists (select 1 from public.vw_function_exposure where anon_can_execute or public_can_execute) then
    raise exception 'vw_function_exposure reports a function open to anon or PUBLIC';
  end if;
  if exists (select 1 from public.vw_anon_exposure where table_name in ('search_outbox', 'search_state')) then
    raise exception 'vw_anon_exposure lists a search table';
  end if;
end $$;
reset role;

-- The trigger set, exactly (insert, update, delete per table; categories and
-- organisations have no works or contacts when new).
do $$
declare
  _found text;
  _want  text := 'categories:delete,categories:update,crm_contacts:delete,crm_contacts:insert,crm_contacts:update,'
                 'crm_organizations:delete,crm_organizations:update,external_pieces:delete,external_pieces:insert,'
                 'external_pieces:update,makers:delete,makers:insert,makers:update,pieces:delete,pieces:insert,'
                 'pieces:update,provenance_entries:delete,provenance_entries:insert,provenance_entries:update';
begin
  select string_agg(tgrelid::regclass::text || ':' || split_part(tgname, '_search_', 2), ',' order by tgrelid::regclass::text, tgname)
    into _found
    from pg_trigger
   where not tgisinternal and tgfoid = 'public.enqueue_search()'::regprocedure;
  if _found is distinct from _want then
    raise exception 'unexpected search triggers: %', _found;
  end if;
  if exists (select 1 from pg_trigger where tgfoid = 'public.enqueue_search()'::regprocedure and (tgtype & 1) = 1) then
    raise exception 'a search trigger is row-level; they are per statement';
  end if;
end $$;

-- ===========================================================================
-- Works, as a member of staff (the triggers are SECURITY DEFINER, so the
-- edit goes through although staff cannot touch the outbox).
-- ===========================================================================
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
insert into public.makers (display_name) values ('Hamada Shoji') returning id as maker_id \gset
insert into public.categories (code, name) values ('TST', 'Test ceramics') returning id as cat_id \gset
insert into public.pieces (title, maker_id, category_id) values ('Tea bowl', :'maker_id', :'cat_id') returning id as piece_id \gset
insert into public.external_pieces (title, maker_id) values ('Consigned jar', :'maker_id') returning id as ext_id \gset
reset role;
select pg_temp.expect('new work', 'work', :'piece_id', 1);
select pg_temp.expect('new work in the other register', 'work', :'ext_id', 1);
select pg_temp.expect('new maker', 'maker', :'maker_id', 1);
select pg_temp.expect('new category (no works yet)', 'category', :'cat_id', 0);
select pg_temp.expect_total('one transaction''s edits', 3);
select pg_temp.expect_wakeups('one transaction, three queued rows', 1);
do $$ begin
  if not exists (select 1 from net.requests r, public.sync_config c
                  where r.url = c.studio_url || '/api/sync/search'
                    and r.headers ->> 'x-sync-secret' = c.secret
                    and r.headers ->> 'x-sync-source' = 'outbox'
                    and r.headers ->> 'Content-Type' = 'application/json'
                    and r.body = '{"source": "outbox"}'::jsonb) then
    raise exception 'the wake-up did not go to /api/sync/search with the sync secret: %',
      (select string_agg(url || ' ' || headers::text, '; ') from net.requests);
  end if;
  -- (The new maker and works also woke the website sync, as before: 0074's own requests.)
end $$;

-- A real edit queues the work; so do the trash and a restore.
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.pieces set title = 'Tea bowl with iron glaze' where id = :'piece_id';
reset role;
select pg_temp.expect('title edit', 'work', :'piece_id', 1);
select pg_temp.expect_wakeups('title edit', 1);
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.pieces set deleted_at = now() where id = :'piece_id';
reset role;
select pg_temp.expect('trashed', 'work', :'piece_id', 1);
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.pieces set deleted_at = null where id = :'piece_id';
reset role;
select pg_temp.expect('restored', 'work', :'piece_id', 1);

-- An autosave that changes nothing (updated_at moves on its own), the AI
-- panel, and the money: nothing queued, nobody woken.
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.pieces set title = title where id = :'piece_id';
update public.pieces set updated_at = now() + interval '1 minute' where id = :'piece_id';
update public.pieces set ai_suggestions = '{"title": "A bowl"}'::jsonb where id = :'piece_id';
update public.external_pieces set ai_suggestions = '{"title": "A jar"}'::jsonb where id = :'ext_id';
update public.pieces set title = 'nothing matches' where id = gen_random_uuid();
reset role;
update public.piece_financials set purchase_cost = 1200, marked_price_gbp = 2400 where piece_id = :'piece_id';
select pg_temp.expect_total('no-op saves, AI suggestions and financials', 0);
select pg_temp.expect_wakeups('no-op saves', 0);

-- One statement over many works: a row each, one wake-up; again for an update.
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
insert into public.pieces (title) select 'Bulk ' || g from generate_series(1, 25) g;
reset role;
select pg_temp.expect_total('25 works in one statement', 25);
select pg_temp.expect_wakeups('25 works in one statement', 1);
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.pieces set medium = 'Stoneware' where title like 'Bulk %';
update public.pieces set medium = 'Stoneware' where title like 'Bulk %';   -- the same again: no change
reset role;
select pg_temp.expect_total('a bulk update, then the same update again', 25);
select pg_temp.expect_wakeups('a bulk update', 1);

-- An edit rolled back (a savepoint) queues nothing and wakes nobody; the
-- next edit in the transaction still wakes the studio, once.
select pg_temp.clear();
savepoint before_edit;
update public.pieces set title = 'Rolled back' where id = :'piece_id';
rollback to savepoint before_edit;
select pg_temp.expect_total('a rolled-back edit', 0);
select pg_temp.expect_wakeups('a rolled-back edit', 0);
update public.pieces set title = 'Tea bowl, iron glaze' where id = :'piece_id';
update public.pieces set period = 'Showa' where id = :'piece_id';
select pg_temp.expect('two edits after a rollback', 'work', :'piece_id', 2);
select pg_temp.expect_wakeups('two edits after a rollback', 1);

-- A purge (a delete) queues the work.
select pg_temp.clear();
delete from public.pieces where title = 'Bulk 1';
select pg_temp.expect_total('a deleted work', 1);

-- ---------------------------------------------------------------------------
-- Provenance belongs to its work; only the indexed columns count.
-- ---------------------------------------------------------------------------
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
insert into public.provenance_entries (piece_id, party, details) values (:'piece_id', 'Private collection, Kyoto', 'Acquired 1968')
  returning id as prov_id \gset
reset role;
select pg_temp.expect('provenance added', 'work', :'piece_id', 1);
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.provenance_entries set is_public = not is_public where id = :'prov_id';
update public.provenance_entries set event_type = 'auction' where id = :'prov_id';
reset role;
select pg_temp.expect_total('provenance flags not in the index', 0);
select t.claims(:'staff_id');
set local role authenticated;
update public.provenance_entries set party = 'Private collection, Tokyo' where id = :'prov_id';
reset role;
select pg_temp.expect('provenance party', 'work', :'piece_id', 1);
select pg_temp.clear();
-- A line moved to another work changes both.
update public.provenance_entries set piece_id = :'ext_id' where id = :'prov_id';
select pg_temp.expect('provenance moved: old work', 'work', :'piece_id', 1);
select pg_temp.expect('provenance moved: new work', 'work', :'ext_id', 1);
select pg_temp.clear();
delete from public.provenance_entries where id = :'prov_id';
select pg_temp.expect('provenance deleted', 'work', :'ext_id', 1);

-- ---------------------------------------------------------------------------
-- Makers, categories, organisations: queued as themselves (the drain
-- re-indexes the works or contacts that carry their names).
-- ---------------------------------------------------------------------------
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
update public.makers set romanized_name = 'Hamada Shōji' where id = :'maker_id';
reset role;
select pg_temp.expect('maker renamed', 'maker', :'maker_id', 1);
select pg_temp.expect_total('maker renamed: its works are the drain''s job', 1);
select pg_temp.clear();
-- Every other indexed maker column, one save each.
update public.makers set native_name = '濱田庄司' where id = :'maker_id';
update public.makers set alt_names = array['Shoji Hamada'] where id = :'maker_id';
update public.makers set school_or_workshop = 'Mingei' where id = :'maker_id';
update public.makers set life_dates = '1894–1978' where id = :'maker_id';
update public.makers set region = 'Mashiko' where id = :'maker_id';
update public.makers set biography = 'Potter' where id = :'maker_id';
update public.makers set profile_html = '<p>Potter of Mashiko</p>' where id = :'maker_id';
update public.makers set web_visible = not coalesce(web_visible, false) where id = :'maker_id';
update public.makers set display_name = 'Hamada Shōji' where id = :'maker_id';
select pg_temp.expect('each indexed maker column', 'maker', :'maker_id', 9);
select pg_temp.clear();
-- What the index does not hold: notes, the portrait and its focus.
update public.makers set notes = 'checked' where id = :'maker_id';
update public.makers set portrait_focus = '{"x": 0.5, "y": 0.3}'::jsonb where id = :'maker_id';
update public.makers set life_dates = '1894–1978' where id = :'maker_id';   -- unchanged value
select pg_temp.expect_total('maker notes, portrait focus, unchanged dates', 0);

select t.claims(:'staff_id');
set local role authenticated;
update public.categories set name = 'Test stoneware' where id = :'cat_id';
reset role;
select pg_temp.expect('category renamed', 'category', :'cat_id', 1);
select pg_temp.clear();
update public.categories set sort_order = 99, is_active = false where id = :'cat_id';
select pg_temp.expect_total('category order and switch', 0);

insert into public.crm_organizations (name) values ('Example Museum') returning id as org_id \gset
select pg_temp.expect_total('a new organisation (no contacts yet)', 0);
insert into public.crm_contacts (first_name, last_name, organization_id) values ('Org', 'Member', :'org_id') returning id as member_id \gset
select pg_temp.clear();
update public.crm_organizations set name = 'Example Art Museum' where id = :'org_id';
select pg_temp.expect('organisation renamed', 'organization', :'org_id', 1);
select pg_temp.expect_total('organisation renamed: its contacts are the drain''s job', 1);
select pg_temp.clear();
update public.crm_organizations set notes = 'Trustee meeting in May', website = 'https://example.org' where id = :'org_id';
select pg_temp.expect_total('organisation notes and website', 0);

-- Deletes: the parent, and through ON DELETE SET NULL the works or contacts
-- that carried it (their own triggers, in the same transaction, one wake-up).
select pg_temp.clear();
delete from public.crm_organizations where id = :'org_id';
select pg_temp.expect('organisation deleted', 'organization', :'org_id', 1);
select pg_temp.expect('organisation deleted: its member', 'contact', :'member_id', 1);
select pg_temp.clear();
insert into public.makers (display_name) values ('Short-lived maker') returning id as gone_maker \gset
insert into public.categories (code, name) values ('GON', 'Short-lived category') returning id as gone_cat \gset
insert into public.pieces (title, maker_id, category_id) values ('Orphan', :'gone_maker', :'gone_cat') returning id as orphan_id \gset
select pg_temp.clear();
delete from public.makers where id = :'gone_maker';
delete from public.categories where id = :'gone_cat';
select pg_temp.expect('maker deleted', 'maker', :'gone_maker', 1);
select pg_temp.expect('category deleted', 'category', :'gone_cat', 1);
select pg_temp.expect('maker and category deleted: the work that carried them', 'work', :'orphan_id', 2);
select pg_temp.expect_wakeups('deletes with cascades', 1);

-- ---------------------------------------------------------------------------
-- Moving a work to the other register is a delete and an insert of the same
-- id: with no "op" on the row the drain simply finds the work where it now is.
-- ---------------------------------------------------------------------------
select pg_temp.clear();
select t.claims(:'admin_id');
set local role authenticated;
select public.move_piece_ledger(:'piece_id', 'external') as moved_to \gset
reset role;
select set_config('t.piece', :'piece_id', true);
do $$ begin
  if not exists (select 1 from public.search_outbox where entity_type = 'work' and entity_id = current_setting('t.piece')::uuid) then
    raise exception 'a register move queued nothing';
  end if;
  if exists (select 1 from public.search_outbox where entity_type <> 'work' or entity_id <> current_setting('t.piece')::uuid) then
    raise exception 'a register move queued something else';
  end if;
  if not exists (select 1 from public.external_pieces where id = current_setting('t.piece')::uuid and deleted_at is null) then
    raise exception 'the moved work is not where the drain will look for it';
  end if;
end $$;
select pg_temp.expect_wakeups('a register move', 1);

-- ===========================================================================
-- Contacts: only the indexed fields count.
-- ===========================================================================
select pg_temp.clear();
select t.claims(:'staff_id');
set local role authenticated;
insert into public.crm_contacts (first_name, last_name, email) values ('Ada', 'Example', 'ada@example.com') returning id as contact_id \gset
reset role;
select pg_temp.expect('new contact', 'contact', :'contact_id', 1);
select pg_temp.clear();
-- The fortnightly sanctions screen (one update per contact, service role),
-- consent bookkeeping, notes and the fields the index leaves out.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.crm_contacts set last_screened_at = now(), sanctions_status = 'clear' where id = :'contact_id';
reset role;
select t.claims(:'staff_id');
set local role authenticated;
update public.crm_contacts set notes = 'Met at the fair', marketing_consent = true, consent_date = now(),
  consent_source = 'fair', consent_evidence = '{"contact": {"at": "2026-11-01"}}'::jsonb where id = :'contact_id';
update public.crm_contacts set unsubscribed_at = now(), do_not_mail = true, email_bounced_at = now() where id = :'contact_id';
update public.crm_contacts set kyc_status = 'pending' where id = :'contact_id';
update public.crm_contacts set tags = array['collector'], interested_regions = array['Japan'], contact_type = 'dealer',
  postcode = 'SW1A 1AA', address_line1 = '1 Example Street', salutation = 'Ms', instagram_handle = 'ada',
  custom_fields = '{"x": 1}'::jsonb where id = :'contact_id';
reset role;
select pg_temp.expect_total('screening, consent, notes and unindexed fields', 0);
select pg_temp.expect_wakeups('the sanctions screen', 0);
-- Each indexed field does count.
select t.claims(:'staff_id');
set local role authenticated;
update public.crm_contacts set last_name = 'Sample' where id = :'contact_id';
update public.crm_contacts set first_name = 'Ada M.' where id = :'contact_id';
update public.crm_contacts set email = 'ada.sample@example.com' where id = :'contact_id';
update public.crm_contacts set phone = '+44 20 7000 0000' where id = :'contact_id';
update public.crm_contacts set whatsapp_number = '+44 7700 900000' where id = :'contact_id';
update public.crm_contacts set city = 'London' where id = :'contact_id';
update public.crm_contacts set country = 'United Kingdom' where id = :'contact_id';
reset role;
select pg_temp.expect('each indexed contact field', 'contact', :'contact_id', 7);
-- erased_at alone counts too (an erased contact's document must go).
select pg_temp.clear();
savepoint erased_only;
update public.crm_contacts set erased_at = now() where id = :'contact_id';
select pg_temp.expect('erased_at alone', 'contact', :'contact_id', 1);
rollback to savepoint erased_only;

-- Erasure, as the studio runs it (the service role): deleted when nothing
-- holds the record, pseudonymised (erased_at set) when a sale does. Either
-- way the contact is queued, so the drain removes its document.
select pg_temp.clear();
insert into public.crm_contacts (first_name, last_name, email) values ('Held', 'Buyer', 'held@example.com') returning id as held_id \gset
update public.piece_financials set buyer_contact_id = :'held_id' where piece_id = :'ext_id';
select pg_temp.clear();
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.erase_contact(:'contact_id') ->> 'mode' as erased_mode \gset
select public.erase_contact(:'held_id') ->> 'mode' as held_mode \gset
reset role;
select set_config('t.contact', :'contact_id', true), set_config('t.held', :'held_id', true),
       set_config('t.erased_mode', :'erased_mode', true), set_config('t.held_mode', :'held_mode', true);
do $$ begin
  if current_setting('t.erased_mode') = current_setting('t.held_mode') then
    raise exception 'setup: expected one deletion and one pseudonymisation, got % and %',
      current_setting('t.erased_mode'), current_setting('t.held_mode');
  end if;
  if exists (select 1 from public.crm_contacts where id = current_setting('t.contact')::uuid) then
    raise exception 'setup: the contact with no hold should be deleted';
  end if;
  if not exists (select 1 from public.crm_contacts where id = current_setting('t.held')::uuid and erased_at is not null) then
    raise exception 'setup: the held contact should be pseudonymised';
  end if;
end $$;
select pg_temp.expect('erased contact (deleted)', 'contact', :'contact_id', 1);
select pg_temp.expect('erased contact (pseudonymised)', 'contact', :'held_id', 1);
do $$ begin
  if exists (select 1 from public.search_outbox where entity_type <> 'contact') then
    raise exception 'an erasure queued something other than the contact';
  end if;
end $$;
select pg_temp.expect_wakeups('two erasures in one transaction', 1);

-- ===========================================================================
-- A broken outbox, a missing sync_config row or a missing pg_net never
-- blocks a save.
-- ===========================================================================
select pg_temp.clear();
alter table public.search_outbox add constraint t_broken check (entity_type = 'nothing') not valid;
select t.claims(:'staff_id');
set local role authenticated;
set local client_min_messages = error;
insert into public.crm_contacts (first_name, last_name) values ('Still', 'Saved') returning id as saved_id \gset
update public.external_pieces set title = 'Saved anyway' where id = :'ext_id';
reset client_min_messages;
reset role;
do $$ begin
  if not exists (select 1 from public.crm_contacts where first_name = 'Still' and last_name = 'Saved') then
    raise exception 'a failing search trigger stopped the save';
  end if;
  if not exists (select 1 from public.external_pieces where title = 'Saved anyway') then
    raise exception 'a failing search trigger stopped the work''s save';
  end if;
end $$;
select pg_temp.expect_total('the broken outbox', 0);
alter table public.search_outbox drop constraint t_broken;

-- No sync_config row (a local database): queued, but nobody to wake.
select pg_temp.clear();
savepoint no_config;
delete from public.sync_config;
update public.external_pieces set title = 'No config' where id = :'ext_id';
select pg_temp.expect('no sync_config: still queued', 'work', :'ext_id', 1);
do $$ begin
  if exists (select 1 from net.requests) then
    raise exception 'with no sync_config row a call was still made: %', (select string_agg(coalesce(url, '(no url)'), ', ') from net.requests);
  end if;
end $$;
rollback to savepoint no_config;

-- pg_net missing: queued, the call skipped with a notice.
select pg_temp.clear();
savepoint no_net;
alter function net.http_post(text, jsonb, jsonb, jsonb, integer) rename to http_post_missing;
set local client_min_messages = warning;
update public.external_pieces set title = 'No pg_net' where id = :'ext_id';
reset client_min_messages;
select pg_temp.expect('no pg_net: still queued', 'work', :'ext_id', 1);
do $$ begin
  if not exists (select 1 from public.external_pieces where title = 'No pg_net') then
    raise exception 'a missing pg_net stopped the save';
  end if;
end $$;
rollback to savepoint no_net;

-- ===========================================================================
-- Claims (the drain runs as the service role).
-- ===========================================================================
-- Two drains at once (the push, the cron, the Admin button) must never take
-- the same rows or wait on each other: one session cannot show that, so
-- check the claim locks with SKIP LOCKED.
do $$ begin
  if pg_get_functiondef('public.claim_search_outbox(integer)'::regprocedure) !~* 'for\s+update\s+skip\s+locked' then
    raise exception 'claim_search_outbox does not claim with FOR UPDATE SKIP LOCKED';
  end if;
end $$;
select pg_temp.clear();
insert into public.search_outbox (entity_type, entity_id)
  select 'work', gen_random_uuid() from generate_series(1, 5);
select (floor(extract(epoch from clock_timestamp()) * 1000))::bigint as before_ms \gset
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
create temp table first_claim on commit drop as select * from public.claim_search_outbox(3);
create temp table second_claim on commit drop as select * from public.claim_search_outbox(10);
create temp table third_claim on commit drop as select * from public.claim_search_outbox(10);
reset role;
select set_config('t.before_ms', :'before_ms', true);
do $$ begin
  if (select count(*) from first_claim) <> 3 or (select count(*) from second_claim) <> 2 or (select count(*) from third_claim) <> 0 then
    raise exception 'claims overlapped or missed rows: %, %, %',
      (select count(*) from first_claim), (select count(*) from second_claim), (select count(*) from third_claim);
  end if;
  if exists (select 1 from first_claim f join second_claim s using (id)) then raise exception 'a row was claimed twice'; end if;
  if (select array_agg(id order by id) from first_claim) <> (select (array_agg(id order by id))[1:3] from public.search_outbox) then
    raise exception 'the claim should take the oldest rows first';
  end if;
  if exists (select 1 from first_claim where entity_type <> 'work' or entity_id is null or claimed_ms is null) then
    raise exception 'a claimed row came back without its type, id or clock';
  end if;
  if (select max(claimed_ms) from first_claim) > (select min(claimed_ms) from second_claim) then
    raise exception 'a later claim got an earlier clock';
  end if;
  if (select min(claimed_ms) from first_claim) < current_setting('t.before_ms')::bigint then
    raise exception 'the claim clock is earlier than the moment before the claim';
  end if;
  if exists (select 1 from first_claim f join public.search_outbox o using (id)
              where floor(extract(epoch from o.claimed_at) * 1000)::bigint <> f.claimed_ms) then
    raise exception 'claimed_ms is not the time recorded on the row';
  end if;
  if exists (select 1 from public.search_outbox where claimed_at is null) then
    raise exception 'rows were left unclaimed';
  end if;
end $$;

-- An edit made while a drain holds the record is queued again (nothing is
-- de-duplicated away) and is free to claim.
insert into public.search_outbox (entity_type, entity_id) select 'work', entity_id from first_claim limit 1;
do $$ begin
  if (select count(*) from public.search_outbox where claimed_at is null) <> 1 then
    raise exception 'an edit made during a drain was not queued';
  end if;
end $$;
set local role service_role;
do $$ begin
  if (select count(*) from public.claim_search_outbox(10)) <> 1 then raise exception 'the re-queued row was not claimable'; end if;
end $$;
reset role;

-- A claim whose drain died lapses after two minutes; one younger does not.
update public.search_outbox set claimed_at = now() - interval '3 minutes' where id in (select id from first_claim);
update public.search_outbox set claimed_at = now() - interval '90 seconds' where id in (select id from second_claim);
set local role service_role;
do $$ begin
  if (select count(*) from public.claim_search_outbox(10)) <> 3 then raise exception 'lapsed claims were not handed out again (or young ones were)'; end if;
  -- The batch is at least one row and at most 1,000.
  if (select count(*) from public.claim_search_outbox(0)) > 1 then raise exception 'a batch of 0 claimed more than one row'; end if;
end $$;
-- The drain deletes what it finished; it cannot queue rows of its own.
delete from public.search_outbox where id in (select id from first_claim);
do $$ begin
  begin insert into public.search_outbox (entity_type, entity_id) values ('work', gen_random_uuid());
    raise exception 'the service role could queue a row';
  exception when insufficient_privilege then null; end;
  begin update public.search_outbox set entity_id = gen_random_uuid();
    raise exception 'the service role could rewrite a queued id';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.search_outbox o join first_claim f using (id)) then
    raise exception 'the drain could not delete its rows';
  end if;
  if (select count(*) from public.search_outbox) <> 3 then raise exception 'the delete took more than the finished rows'; end if;
end $$;

-- The clock the reconcile uses: now, in milliseconds.
select (floor(extract(epoch from clock_timestamp()) * 1000))::bigint as clock_before \gset
set local role service_role;
select public.search_clock_ms() as clock_ms \gset
reset role;
select (floor(extract(epoch from clock_timestamp()) * 1000))::bigint as clock_after \gset
select set_config('t.clock_before', :'clock_before', true), set_config('t.clock_ms', :'clock_ms', true),
       set_config('t.clock_after', :'clock_after', true);
do $$ begin
  if current_setting('t.clock_ms')::bigint not between current_setting('t.clock_before')::bigint and current_setting('t.clock_after')::bigint then
    raise exception 'search_clock_ms() is not the current time in ms: % not in [%, %]',
      current_setting('t.clock_ms'), current_setting('t.clock_before'), current_setting('t.clock_after');
  end if;
end $$;

-- search_state: the studio's upsert on kind (indexer.ts writeState), and the
-- kinds it knows.
set local role service_role;
insert into public.search_state (kind, last_run_at, last_result, last_error, updated_at)
  values ('works', now(), 'ok: 3 indexed', null, now())
  on conflict (kind) do update set last_run_at = excluded.last_run_at, last_result = excluded.last_result,
                                   last_error = excluded.last_error, updated_at = excluded.updated_at;
insert into public.search_state (kind, last_run_at, last_result, last_error, updated_at)
  values ('works', now(), 'ok: 4 indexed', null, now())
  on conflict (kind) do update set last_run_at = excluded.last_run_at, last_result = excluded.last_result,
                                   last_error = excluded.last_error, updated_at = excluded.updated_at;
insert into public.search_state (kind, last_result) values ('drain', 'ok'), ('makers', 'ok'), ('contacts', 'ok');
do $$ begin
  if (select count(*) from public.search_state) <> 4 or (select last_result from public.search_state where kind = 'works') <> 'ok: 4 indexed' then
    raise exception 'search_state upsert did not keep one row per kind';
  end if;
  begin insert into public.search_state (kind) values ('records'); raise exception 'an unknown kind was accepted';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  begin insert into public.search_outbox (entity_type, entity_id) values ('location', gen_random_uuid());
    raise exception 'an unknown entity type was accepted';
  exception when check_violation then null; end;
end $$;

-- ===========================================================================
-- Retention: rows the studio never drained go after 14 days, claimed or not.
-- ===========================================================================
delete from public.search_outbox;
insert into public.search_outbox (entity_type, entity_id, queued_at, claimed_at) values
  ('work',    gen_random_uuid(), now() - interval '15 days', null),
  ('contact', gen_random_uuid(), now() - interval '20 days', now() - interval '19 days'),
  ('maker',   gen_random_uuid(), now() - interval '13 days', null),
  ('work',    gen_random_uuid(), now(), null);
do $$ begin
  if not exists (select 1 from public.retention_policies where key = 'search_outbox' and days = 14 and mode = 'purge') then
    raise exception 'search_outbox has no 14-day purge policy';
  end if;
end $$;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.apply_retention()::text as retention \gset
reset role;
select set_config('t.retention', :'retention', true);
do $$
declare
  _r jsonb := current_setting('t.retention')::jsonb;
  _k text;
begin
  if (_r ->> 'search_outbox')::int is distinct from 2 then
    raise exception 'apply_retention() should report 2 purged outbox rows: %', _r;
  end if;
  foreach _k in array array['email_events', 'offer_views', 'campaign_recipients', 'enquiries', 'appointments',
                            'unconfirmed_signups', 'activity_log', 'rate_limit_hits', 'pending_uploads',
                            'webauthn_challenges', 'pending_optins', 'ran_at']
  loop
    if not _r ? _k then raise exception 'apply_retention() lost the % key: %', _k, _r; end if;
  end loop;
  if (select count(*) from public.search_outbox) <> 2
     or exists (select 1 from public.search_outbox where queued_at < now() - interval '14 days') then
    raise exception 'the wrong outbox rows were purged';
  end if;
end $$;
-- The sweep follows the policy (Admin → Data protection can change it).
update public.retention_policies set days = 1 where key = 'search_outbox';
select public.apply_retention() ->> 'search_outbox' as purged_now \gset
select set_config('t.purged_now', :'purged_now', true);
do $$ begin
  if current_setting('t.purged_now')::int <> 1 or (select count(*) from public.search_outbox) <> 1 then
    raise exception 'a shorter period should purge the 13-day-old row';
  end if;
end $$;
update public.retention_policies set days = 14 where key = 'search_outbox';

-- ===========================================================================
-- Re-running the migration is harmless: one trigger set, one policy row,
-- one queued row per change.
-- ===========================================================================
\ir ../../../supabase/migrations/0100_search_outbox.sql
select pg_temp.clear();
update public.external_pieces set title = 'After a re-run' where id = :'ext_id';
do $$ begin
  if (select count(*) from pg_trigger where not tgisinternal
        and tgfoid in ('public.enqueue_search()'::regprocedure, 'public.push_search_outbox()'::regprocedure)) <> 20 then
    raise exception 're-running the migration changed the number of search triggers';
  end if;
  if (select count(*) from public.retention_policies where key = 'search_outbox') <> 1 then
    raise exception 're-running the migration duplicated the policy row';
  end if;
end $$;
select pg_temp.expect('one edit after a re-run', 'work', :'ext_id', 1);
select pg_temp.expect_total('one edit after a re-run', 1);
select pg_temp.expect_wakeups('one edit after a re-run', 1);
rollback;

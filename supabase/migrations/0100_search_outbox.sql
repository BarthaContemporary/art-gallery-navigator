-- 0100_search_outbox
-- Keeps the studio's OpenSearch indices current (apps/studio/src/lib/opensearch).
--
-- Triggers note WHICH record changed in search_outbox; the studio's
-- /api/sync/search claims the rows, reads each record's current state with
-- the service client and indexes it, or removes it when it is gone, in the
-- trash or erased, then deletes the rows it finished. A nightly reconcile
-- (/api/cron/search-reconcile, and Admin → Search → "Reconcile now") puts
-- right anything a trigger or a drain missed. Without this migration, or
-- without OPENSEARCH_URL, the studio searches Postgres alone, as before.
--
-- How it differs from the website outbox (0010, 0074, 0082), on purpose:
--   • no "op": the drain decides from the record's state, so a delete and an
--     insert of the same id in one transaction (move_piece_ledger) can never
--     leave the wrong instruction;
--   • no de-duplication when a row is queued: every committed change has its
--     own row, so a change is never dropped because "one is already waiting"
--     for a drain that has in fact already read the record. The drain
--     de-duplicates the batch it claims instead;
--   • rows are deleted when done; whatever is never drained (the studio not
--     deployed yet, say) is purged by apply_retention() after 14 days;
--   • one wake-up per transaction: pg_net sends after commit, when every row
--     of the transaction is visible, so the route needs no settle delay and a
--     500-row statement still makes one call; a rolled-back edit sends none;
--   • one queue insert per statement (statement-level triggers over the
--     transition tables), so a bulk update is one insert, not one per row;
--   • a failure inside a trigger is a warning, never a failed save;
--   • the triggers ignore what the indices do not hold: for works the noise
--     columns (updated_at, updated_by, search_vector, ai_suggestions), for
--     everything else all but the indexed columns
--     (apps/studio/src/lib/opensearch/documents.ts *_COLUMNS). So the
--     fortnightly sanctions screen (last_screened_at on every contact),
--     consent bookkeeping, contact notes, a maker's portrait focus and the
--     AI panel queue nothing.
--
-- What is queued, as which entity_type:
--   pieces, external_pieces  any column but the noise ones           'work'
--   provenance_entries       sort_order, date_text, party, details   'work' (its piece_id)
--   makers                   every indexed maker column               'maker' (the drain
--                            re-indexes the maker and its works: works carry its names)
--   categories               name                                     'category' (its works)
--   crm_contacts             the indexed columns and erased_at        'contact'
--   crm_organizations        name                                     'organization' (its contacts)
-- A location rename reaches the works' documents at the nightly reconcile.
--
-- No personal data: entity types and ids only (never a payload). RLS on with
-- no policies; the service role only, and only what the library uses.
--
-- Idempotent; safe to re-run. To take it out again:
--   drop trigger … (the trg_*_search_* triggers below);
--   drop function public.enqueue_search(), public.push_search_outbox(),
--     public.claim_search_outbox(integer), public.search_clock_ms();
--   drop table public.search_outbox, public.search_state;
--   delete from public.retention_policies where key = 'search_outbox';
--   and apply_retention() as in 0097.

-- ===========================================================================
-- 1. The queue and the run record
-- ===========================================================================
create table if not exists public.search_outbox (
  id          bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('work', 'maker', 'category', 'contact', 'organization')),
  entity_id   uuid not null,
  queued_at   timestamptz not null default clock_timestamp(),
  claimed_at  timestamptz
);
comment on table public.search_outbox is
  'Records whose search documents are stale; drained by the studio /api/sync/search. Ids only. Service role only.';

alter table public.search_outbox enable row level security;
revoke all on public.search_outbox from public, anon, authenticated, service_role;
-- The drain: claim (claim_search_outbox runs as the caller), delete what it
-- finished; the Admin page counts what waits.
grant select, delete on public.search_outbox to service_role;
grant update (claimed_at) on public.search_outbox to service_role;
do $$
declare _seq text := pg_get_serial_sequence('public.search_outbox', 'id');
begin
  -- Only the triggers (as the table's owner) insert.
  execute format('revoke all on sequence %s from public, anon, authenticated, service_role', _seq);
end;
$$;

-- One row per kind the studio runs: the reconcile of each index and the drain.
create table if not exists public.search_state (
  kind        text primary key check (kind in ('works', 'makers', 'contacts', 'drain')),
  last_run_at timestamptz,
  last_result text,
  last_error  text,
  updated_at  timestamptz not null default now()
);
comment on table public.search_state is
  'The studio''s last search reconcile per index and last outbox drain: when, a summary and an error (counts and error types only). Service role only.';

alter table public.search_state enable row level security;
revoke all on public.search_state from public, anon, authenticated, service_role;
-- The studio upserts on kind and the Admin page reads it.
grant select, insert, update on public.search_state to service_role;

-- ===========================================================================
-- 2. The triggers
-- ===========================================================================
-- enqueue_search(entity_type, key_column [, watched_columns])
--   … for each statement execute function enqueue_search('work', 'id')
--   … for each statement execute function enqueue_search('work', 'piece_id', 'party,details')
-- Statement-level, over the transition tables old_rows / new_rows (every
-- table here has an `id` primary key, which pairs old and new rows). With no
-- column list, an update counts when any column but the noise ones changed;
-- with one, when a listed column or the key column changed. Both the old and
-- the new key are queued (a provenance line moved to another work changes
-- both works).
create or replace function public.enqueue_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _type  text   := tg_argv[0];
  _key   text   := tg_argv[1];
  _watch text[] := case when tg_nargs > 2 then string_to_array(tg_argv[2], ',') end;
  _noise constant text[] := array['updated_at', 'updated_by', 'search_vector', 'ai_suggestions'];
begin
  if tg_op = 'INSERT' then
    insert into public.search_outbox (entity_type, entity_id)
    select distinct _type, k.id
      from new_rows n
      cross join lateral (values ((to_jsonb(n) ->> _key)::uuid)) as k(id)
     where k.id is not null;
  elsif tg_op = 'DELETE' then
    insert into public.search_outbox (entity_type, entity_id)
    select distinct _type, k.id
      from old_rows o
      cross join lateral (values ((to_jsonb(o) ->> _key)::uuid)) as k(id)
     where k.id is not null;
  elsif tg_op = 'UPDATE' then
    insert into public.search_outbox (entity_type, entity_id)
    select distinct _type, k.id
      from (select to_jsonb(n) as jn, to_jsonb(o) as jo
              from new_rows n
              full join old_rows o on o.id = n.id) r
      cross join lateral (values ((r.jn ->> _key)::uuid), ((r.jo ->> _key)::uuid)) as k(id)
     where k.id is not null
       and case
             when _watch is null then (r.jn - _noise) is distinct from (r.jo - _noise)
             else exists (select 1 from unnest(_watch || _key) c where (r.jn -> c) is distinct from (r.jo -> c))
           end;
  end if;
  return null;
exception when others then
  -- Search is a convenience: nothing here may ever stop a save. The nightly
  -- reconcile puts right whatever a failed trigger did not queue.
  raise warning 'search outbox skipped for % %: %', tg_table_name, tg_op, sqlerrm;
  return null;
end;
$$;
-- A trigger function cannot be called directly; nobody needs execute on it.
revoke execute on function public.enqueue_search() from public, anon, authenticated;

do $$
declare
  _t   record;
  _ev  text;
begin
  for _t in
    select * from (values
      ('pieces',             'work',         'id',       null,                     array['insert', 'update', 'delete']),
      ('external_pieces',    'work',         'id',       null,                     array['insert', 'update', 'delete']),
      ('provenance_entries', 'work',         'piece_id', 'sort_order,date_text,party,details',
                                                                                   array['insert', 'update', 'delete']),
      ('makers',             'maker',        'id',       'display_name,native_name,romanized_name,alt_names,school_or_workshop,'
                                                         'life_dates,region,biography,profile_html,web_visible',
                                                                                   array['insert', 'update', 'delete']),
      ('categories',         'category',     'id',       'name',                   array['update', 'delete']),
      ('crm_contacts',       'contact',      'id',       'first_name,last_name,organization_id,email,phone,whatsapp_number,'
                                                         'city,country,erased_at',
                                                                                   array['insert', 'update', 'delete']),
      ('crm_organizations',  'organization', 'id',       'name',                   array['update', 'delete'])
    ) as v (tbl, kind, key, watch, events)
  loop
    foreach _ev in array _t.events
    loop
      execute format('drop trigger if exists %I on public.%I', format('trg_%s_search_%s', _t.tbl, _ev), _t.tbl);
      execute format(
        'create trigger %I after %s on public.%I referencing %s for each statement '
        'execute function public.enqueue_search(%L, %L%s)',
        format('trg_%s_search_%s', _t.tbl, _ev),
        _ev,
        _t.tbl,
        case _ev
          when 'insert' then 'new table as new_rows'
          when 'delete' then 'old table as old_rows'
          else 'old table as old_rows new table as new_rows'
        end,
        _t.kind,
        _t.key,
        case when _t.watch is null then '' else format(', %L', _t.watch) end);
    end loop;
  end loop;
end;
$$;

-- ===========================================================================
-- 3. Wake the studio: once per transaction, however many rows it queued
-- ===========================================================================
-- As 0074 does for the website sync: the address and the secret come from
-- sync_config, and a missing row (a local database) or a pg_net problem
-- (pg_net not installed) skips the call with a notice; the studio's
-- 10-minute cron drains the outbox anyway. pg_net queues the request in
-- this transaction and sends it after commit, so a rolled-back edit sends
-- nothing. The guard is transaction-local: a savepoint rolled back with its
-- rows also forgets that it woke the studio.
create or replace function public.push_search_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  cfg public.sync_config%rowtype;
begin
  if not exists (select 1 from new_rows) then
    return null;
  end if;
  if current_setting('jvb.search_pushed', true) = txid_current()::text then
    return null;
  end if;
  perform set_config('jvb.search_pushed', txid_current()::text, true);

  begin
    select * into cfg from public.sync_config where id = 1;
    if not found then
      return null;
    end if;
    perform net.http_post(
      url := cfg.studio_url || '/api/sync/search',
      body := jsonb_build_object('source', 'outbox'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', cfg.secret,
        'x-sync-source', 'outbox'),
      timeout_milliseconds := 60000);
  exception when others then
    -- Never let a wake-up problem block the edit; the cron drains the outbox.
    raise notice 'search push skipped: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function public.push_search_outbox() from public, anon, authenticated;

drop trigger if exists trg_search_outbox_push on public.search_outbox;
create trigger trg_search_outbox_push
  after insert on public.search_outbox
  referencing new table as new_rows
  for each statement execute function public.push_search_outbox();

-- ===========================================================================
-- 4. The drain's claim and the database clock
-- ===========================================================================
-- claim_search_outbox(batch): rows for one drain, oldest first, SKIP LOCKED
-- so overlapping drains (the push, the cron, the Admin button) never take
-- the same row, and a claim lapsing after two minutes (a drain that died, or
-- whose writes failed, leaves its rows to the next one). claimed_ms is the
-- database clock at the claim, in milliseconds, taken while the statement
-- runs, so it is later than anything the claim can see. The drain reads the
-- records AFTER this moment and writes each document at the largest
-- claimed_ms of its batch as an external version (version_type
-- external_gte): of two writers, the one that read the database later wins,
-- whichever reaches OpenSearch first. Runs as the caller (the service role,
-- whose grants above and BYPASSRLS are what it needs).
create or replace function public.claim_search_outbox(batch integer default 200)
returns table (id bigint, entity_type text, entity_id uuid, claimed_ms bigint)
language sql
volatile
set search_path = public
as $$
  update public.search_outbox o
     set claimed_at = clock_timestamp()
   where o.id in (
     select x.id
       from public.search_outbox x
      where x.claimed_at is null
         or x.claimed_at < clock_timestamp() - interval '2 minutes'
      order by x.id
      limit greatest(1, least(coalesce(batch, 200), 1000))
        for update skip locked)
  returning o.id, o.entity_type, o.entity_id, floor(extract(epoch from o.claimed_at) * 1000)::bigint;
$$;
revoke execute on function public.claim_search_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_search_outbox(integer) to service_role;

-- The same clock for the reconcile, which claims nothing: taken before it
-- reads anything, so everything it reads is at least this fresh.
create or replace function public.search_clock_ms()
returns bigint
language sql
volatile
set search_path = public
as $$ select floor(extract(epoch from clock_timestamp()) * 1000)::bigint $$;
revoke execute on function public.search_clock_ms() from public, anon, authenticated;
grant execute on function public.search_clock_ms() to service_role;

-- ===========================================================================
-- 5. Retention
-- ===========================================================================
-- Rows normally live for seconds. One the studio never drains (the route not
-- deployed yet, the cron off) goes after 14 days: the nightly reconcile has
-- long since put the index right. (CLAUDE.md personal-data rule: a contact
-- id names a person's record, though nothing about them.)
insert into public.retention_policies (key, label, days, mode, basis) values
  ('search_outbox', 'Search index change queue (record ids only)', 14, 'purge',
   'Legitimate interest — keeping the studio''s search current; normally deleted within seconds, and the nightly reconcile covers anything older')
on conflict (key) do nothing;

-- apply_retention() as in 0097, plus the search_outbox sweep (its own key in
-- the result; every other key unchanged).
create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _d integer; _n integer; _out jsonb := '{}'::jsonb;
  _ids uuid[]; _emails text[];
begin
  select days into _d from public.retention_policies where key = 'email_events' and mode = 'purge';
  if _d is not null then
    delete from public.email_events where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('email_events', _n);
  end if;

  select days into _d from public.retention_policies where key = 'offer_views' and mode = 'purge';
  if _d is not null then
    delete from public.offer_views where viewed_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('offer_views', _n);
  end if;

  select days into _d from public.retention_policies where key = 'campaign_recipients' and mode = 'purge';
  if _d is not null then
    delete from public.crm_campaign_recipients where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('campaign_recipients', _n);
  end if;

  select days into _d from public.retention_policies where key = 'enquiries' and mode = 'purge';
  if _d is not null then
    delete from public.enquiries where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('enquiries', _n);
  end if;

  select days into _d from public.retention_policies where key = 'appointments' and mode = 'purge';
  if _d is not null then
    delete from public.appointments where coalesce(ends_at, starts_at, created_at) < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('appointments', _n);
  end if;

  select days into _d from public.retention_policies where key = 'unconfirmed_signups' and mode = 'purge';
  if _d is not null then
    -- A sign-up that was never confirmed, that nothing holds, and that
    -- nobody at the gallery has worked with.
    with cand as (
      select c.id, nullif(lower(btrim(c.email)), '') as email
        from public.crm_contacts c
       where c.consent_confirm_token is not null
         and not c.marketing_consent
         and c.consent_confirm_sent_at < now() - make_interval(days => _d)
         and coalesce(array_length(public.contact_legal_holds(c.id), 1), 0) = 0
         and not exists (select 1 from public.enquiries e where e.contact_id = c.id)
         and not exists (select 1 from public.appointments a where a.contact_id = c.id)
         and not exists (select 1 from public.crm_interactions i where i.contact_id = c.id)
         and not exists (select 1 from public.offer_recipients r where r.contact_id = c.id)
         and not exists (select 1 from public.crm_list_members m where m.contact_id = c.id)
         and not exists (select 1 from public.crm_campaign_recipients r where r.contact_id = c.id)
         and not exists (select 1 from public.dp_requests q where q.contact_id = c.id)
         and c.tags <@ array['newsletter', 'website']::text[]
         and c.kyc_status = 'not_started'
         and c.custom_fields = '{}'::jsonb
         and c.interested_regions = '{}'::text[]
         and c.organization_id is null
         and btrim(concat(c.salutation, c.phone, c.address_line1, c.address_line2, c.city, c.postcode,
                          c.country, c.instagram_handle, c.whatsapp_number, c.line_id, c.wechat_id,
                          c.notes)) = ''
       for update
    )
    select coalesce(array_agg(cand.id), '{}'), coalesce(array_agg(cand.email) filter (where cand.email is not null), '{}')
      into _ids, _emails
      from cand;

    if cardinality(_ids) > 0 then
      perform public.scrub_email_events(_ids, _emails);
      with del as (delete from public.crm_contacts c where c.id = any (_ids) returning c.id)
      select coalesce(array_agg(del.id), '{}') into _ids from del;
      delete from public.activity_log where entity_type = 'crm_contacts' and entity_id = any (_ids);
    end if;
    _out := _out || jsonb_build_object('unconfirmed_signups', cardinality(_ids));
  end if;

  select days into _d from public.retention_policies where key = 'activity_log' and mode = 'purge';
  if _d is not null then
    delete from public.activity_log where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('activity_log', _n);
  end if;

  select days into _d from public.retention_policies where key = 'rate_limit_hits' and mode = 'purge';
  if _d is not null then
    delete from public.rate_limit_hits where at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('rate_limit_hits', _n);
  end if;

  -- Short-lived security records: unclaimed upload slips (0090), unused
  -- passkey challenges (0092).
  select days into _d from public.retention_policies where key = 'security_tokens' and mode = 'purge';
  if _d is not null then
    delete from public.pending_uploads where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_uploads', _n);
    delete from public.webauthn_challenges where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('webauthn_challenges', _n);
  end if;

  -- A newsletter confirmation asked for on an existing contact's behalf and
  -- never confirmed (0095): its link has expired, so the pending entry goes.
  select days into _d from public.retention_policies where key = 'pending_optins' and mode = 'purge';
  if _d is not null then
    update public.crm_contacts
       set consent_evidence = consent_evidence - 'marketing_pending'
     where consent_evidence ? 'marketing_pending'
       and coalesce((consent_evidence -> 'marketing_pending' ->> 'at')::timestamptz, '-infinity'::timestamptz)
           < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_optins', _n);
  end if;

  -- Search index change queue rows the studio never drained (0100).
  select days into _d from public.retention_policies where key = 'search_outbox' and mode = 'purge';
  if _d is not null then
    delete from public.search_outbox where queued_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('search_outbox', _n);
  end if;

  return _out || jsonb_build_object('ran_at', now());
end;
$$;
revoke execute on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

notify pgrst, 'reload schema';

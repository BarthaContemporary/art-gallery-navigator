-- 0056_external_register
-- ---------------------------------------------------------------------------
-- A second, dedicated stock table for works that sit in the gallery and behave
-- like stock but are not JvdB's property ("In Stock but not JvdB").
--
-- The obstacle to a second table is that eighteen satellite tables carry a
-- foreign key to pieces(id) — images, documents, financials, list items, offer
-- lines, shipments, provenance, exhibitions, location history, embeddings,
-- watches, order items, enquiries, consignment items, document links, capture
-- links and the legacy FileMaker rows. Duplicating all of those is what makes
-- the obvious version of this change enormous.
--
-- So the UUID is lifted out into an identity registry, and the two stock tables
-- become siblings beneath it:
--
--     piece_ref (id, ledger)              one row per work, for its whole life
--        ├── pieces           id -> piece_ref.id     JvdB      "2026-0001"
--        └── external_pieces  id -> piece_ref.id     not JvdB  "X-2026-0001"
--
--     18 satellites: piece_id -> piece_ref.id
--
-- Three things follow. Reclassification is an INSERT into one table and a
-- DELETE from the other, with every image, document, list membership and offer
-- line still attached because they point at the identity, not the register.
-- The activity log keys on the same UUID, so a work's history is continuous
-- across the move. And the five stock-book views read FROM pieces — an external
-- work is not in that table, so it is structurally incapable of appearing in
-- the stock book. Those views are not touched by this migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Ledger enum, and the tag each stock table carries
--
-- piece_ref.ledger is the authority. The copy on each stock table is a
-- convenience so that unions (vw_pieces_list, pieces_search) carry it for free;
-- a CHECK constraint pinning it to a single value makes it impossible for the
-- copy to disagree with the table it sits in.
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.piece_ledger as enum ('jvb', 'external');
exception
  when duplicate_object then null;
end;
$$;

alter table public.pieces
  add column if not exists ledger public.piece_ledger not null default 'jvb';

alter table public.pieces drop constraint if exists pieces_ledger_check;
alter table public.pieces add constraint pieces_ledger_check check (ledger = 'jvb');

-- ---------------------------------------------------------------------------
-- 2. The identity registry
-- ---------------------------------------------------------------------------
create table if not exists public.piece_ref (
  id         uuid primary key,
  ledger     public.piece_ledger not null default 'jvb',
  created_at timestamptz not null default now()
);

comment on table public.piece_ref is
  'Identity of a work, independent of which stock table currently holds it. '
  'Satellites (images, documents, financials, list items, …) key on this so a '
  'move between registers never touches them.';

create index if not exists idx_piece_ref_ledger on public.piece_ref (ledger);

-- Every existing piece is JvdB stock.
insert into public.piece_ref (id, ledger, created_at)
select p.id, 'jvb', p.created_at from public.pieces p
on conflict (id) do nothing;

alter table public.pieces drop constraint if exists pieces_id_fkey;
alter table public.pieces
  add constraint pieces_id_fkey foreign key (id)
  references public.piece_ref (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. The second stock table
--
-- LIKE ... INCLUDING ALL copies columns, defaults, CHECK/NOT NULL constraints,
-- generated columns (search_vector), indexes and the primary key — but not
-- foreign keys, triggers, RLS or grants, which are restated below. Copying the
-- unique index on stock_number is deliberate: each register is its own
-- namespace.
-- ---------------------------------------------------------------------------
create table if not exists public.external_pieces (like public.pieces including all);

comment on table public.external_pieces is
  'Works held and handled like stock but not owned by JvdB. Own stock-number '
  'series ("X-2026-0001"); never reachable from the stock book, which reads '
  'from public.pieces.';

alter table public.external_pieces alter column ledger set default 'external';

-- LIKE copies the CHECK constraints, including the one pinning ledger to
-- 'jvb'; the copy's name is chosen by the system, so find it by definition.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.external_pieces'::regclass
       and contype  = 'c'
       and pg_get_constraintdef(oid) ilike '%ledger%'
  loop
    execute format('alter table public.external_pieces drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.external_pieces
  add constraint external_pieces_ledger_check check (ledger = 'external');

-- Outgoing foreign keys, mirroring public.pieces.
alter table public.external_pieces
  add constraint external_pieces_id_fkey foreign key (id)
    references public.piece_ref (id) on delete cascade,
  add constraint external_pieces_maker_id_fkey foreign key (maker_id)
    references public.makers (id) on delete set null,
  add constraint external_pieces_category_id_fkey foreign key (category_id)
    references public.categories (id) on delete set null,
  add constraint external_pieces_location_id_fkey foreign key (location_id)
    references public.locations (id) on delete set null,
  add constraint external_pieces_created_by_fkey foreign key (created_by)
    references auth.users (id) on delete set null,
  add constraint external_pieces_updated_by_fkey foreign key (updated_by)
    references auth.users (id) on delete set null,
  add constraint external_pieces_consignee_contact_id_fkey foreign key (consignee_contact_id)
    references public.crm_contacts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Re-point the satellites at the identity
--
-- Generated from the catalogue rather than listed by hand so that none is
-- missed and each keeps its own ON DELETE action and column name (note
-- capture_works uses pushed_piece_id).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select con.conname,
           cl.relname                                as tbl,
           att.attname                               as col,
           case con.confdeltype when 'c' then 'cascade'
                                when 'n' then 'set null'
                                when 'r' then 'restrict'
                                when 'd' then 'set default'
                                else 'no action' end as del_action
      from pg_constraint con
      join pg_class     cl  on cl.oid = con.conrelid
      join pg_class     rf  on rf.oid = con.confrelid
      join pg_attribute att on att.attrelid = con.conrelid
                           and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and rf.relname  = 'pieces'
       and cl.relname <> 'external_pieces'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.piece_ref (id) on delete %s',
      r.tbl, r.conname, r.col, r.del_action);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Identity lifecycle
--
-- The registry row must exist before the stock row that references it, and
-- must outlive a move (which inserts into the destination before deleting from
-- the source, so the satellites are never briefly orphaned).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_piece_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := coalesce(new.id, gen_random_uuid());
  insert into public.piece_ref (id, ledger)
  values (new.id, tg_argv[0]::public.piece_ledger)
  on conflict (id) do update set ledger = excluded.ledger;
  return new;
end;
$$;

create or replace function public.cleanup_piece_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when the work has left both registers for good.
  if not exists (select 1 from public.pieces          where id = old.id)
 and not exists (select 1 from public.external_pieces where id = old.id) then
    delete from public.piece_ref where id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_pieces_ensure_ref on public.pieces;
create trigger trg_pieces_ensure_ref
  before insert on public.pieces
  for each row execute function public.ensure_piece_ref('jvb');

drop trigger if exists trg_pieces_cleanup_ref on public.pieces;
create trigger trg_pieces_cleanup_ref
  after delete on public.pieces
  for each row execute function public.cleanup_piece_ref();

-- ---------------------------------------------------------------------------
-- 6. The external stock-number series
--
-- Mirrors next_stock_number() from 0004: a per-year counter row plus a
-- transaction-scoped advisory lock, on its own namespace so the two series
-- never contend or collide.
-- ---------------------------------------------------------------------------
create table if not exists public.external_stock_number_counters (
  year     int primary key,
  last_seq int not null default 0
);

comment on table public.external_stock_number_counters is
  'Per-year sequence for non-JvdB stock numbers ("X-2026-0001"). Entirely '
  'independent of stock_number_counters.';

create or replace function public.next_external_stock_number(_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _seq int;
begin
  perform pg_advisory_xact_lock(hashtext('external_stock_number' || _year::text));

  insert into public.external_stock_number_counters as c (year, last_seq)
  values (_year, 1)
  on conflict (year)
  do update set last_seq = c.last_seq + 1
  returning last_seq into _seq;

  return format('X-%s-%s', _year, lpad(_seq::text, 4, '0'));
end;
$$;

create or replace function public.assign_external_stock_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock_number is null or new.stock_number = '' then
    new.stock_number := public.next_external_stock_number(extract(year from now())::int);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Restate the behaviour of pieces on external_pieces
--
-- The four trigger functions are table-agnostic (they key on new.id and
-- tg_table_name), so they are reused verbatim; only stock numbering differs.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_external_pieces_ensure_ref on public.external_pieces;
create trigger trg_external_pieces_ensure_ref
  before insert on public.external_pieces
  for each row execute function public.ensure_piece_ref('external');

drop trigger if exists trg_external_pieces_assign_stock_number on public.external_pieces;
create trigger trg_external_pieces_assign_stock_number
  before insert on public.external_pieces
  for each row execute function public.assign_external_stock_number();

drop trigger if exists trg_external_pieces_updated_at on public.external_pieces;
create trigger trg_external_pieces_updated_at
  before update on public.external_pieces
  for each row execute function public.set_updated_at();

drop trigger if exists trg_external_pieces_create_financials on public.external_pieces;
create trigger trg_external_pieces_create_financials
  after insert on public.external_pieces
  for each row execute function public.create_piece_financials();

drop trigger if exists trg_external_pieces_location_history on public.external_pieces;
create trigger trg_external_pieces_location_history
  after update on public.external_pieces
  for each row when (old.location_id is distinct from new.location_id)
  execute function public.track_piece_location();

drop trigger if exists trg_log_external_pieces on public.external_pieces;
create trigger trg_log_external_pieces
  after insert or update or delete on public.external_pieces
  for each row execute function public.log_activity();

drop trigger if exists trg_external_pieces_sync_outbox on public.external_pieces;
create trigger trg_external_pieces_sync_outbox
  after insert or update or delete on public.external_pieces
  for each row execute function public.enqueue_piece_sync();

drop trigger if exists trg_external_pieces_cleanup_ref on public.external_pieces;
create trigger trg_external_pieces_cleanup_ref
  after delete on public.external_pieces
  for each row execute function public.cleanup_piece_ref();

-- Same access rules as pieces.
alter table public.external_pieces enable row level security;

drop policy if exists admin_all          on public.external_pieces;
drop policy if exists staff_all          on public.external_pieces;
drop policy if exists accountant_select  on public.external_pieces;

create policy admin_all on public.external_pieces
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy staff_all on public.external_pieces
  for all to authenticated
  using (public.has_role(auth.uid(), 'staff'))
  with check (public.has_role(auth.uid(), 'staff'));

create policy accountant_select on public.external_pieces
  for select to authenticated
  using (public.has_role(auth.uid(), 'accountant'));

grant select, insert, update, delete on public.external_pieces to authenticated, service_role;
grant select on public.piece_ref to authenticated, service_role;

alter table public.piece_ref enable row level security;
drop policy if exists read_all on public.piece_ref;
create policy read_all on public.piece_ref
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 8. Schema drift guard
--
-- Two tables that must stay identical will not, unless something checks. This
-- view is asserted by move_piece_ledger() and surfaced in the studio.
-- ---------------------------------------------------------------------------
create or replace view public.vw_ledger_schema_drift as
select coalesce(a.column_name, b.column_name) as column_name,
       a.data_type                            as pieces_type,
       b.data_type                            as external_pieces_type
  from (select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'pieces') a
  full outer join
       (select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'external_pieces') b
    on b.column_name = a.column_name
 where a.column_name is null
    or b.column_name is null
    or a.data_type is distinct from b.data_type;

comment on view public.vw_ledger_schema_drift is
  'Columns that exist in one stock table but not the other. Must be empty: a '
  'column added to pieces must be added to external_pieces in the same migration.';

grant select on public.vw_ledger_schema_drift to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. The move log
--
-- A retired stock number does not stop existing — it is on labels, in emails
-- and in PDFs — so it stays resolvable to the record that now carries a
-- different one.
-- ---------------------------------------------------------------------------
create table if not exists public.piece_ledger_moves (
  id               uuid primary key default gen_random_uuid(),
  piece_id         uuid not null references public.piece_ref (id) on delete cascade,
  from_ledger      public.piece_ledger not null,
  to_ledger        public.piece_ledger not null,
  from_stock_number text not null,
  to_stock_number   text not null,
  note             text,
  moved_by         uuid references auth.users (id) on delete set null,
  moved_at         timestamptz not null default now()
);

create index if not exists idx_piece_ledger_moves_piece on public.piece_ledger_moves (piece_id);
create index if not exists idx_piece_ledger_moves_from  on public.piece_ledger_moves (from_stock_number);

alter table public.piece_ledger_moves enable row level security;
drop policy if exists read_all on public.piece_ledger_moves;
create policy read_all on public.piece_ledger_moves
  for select to authenticated using (true);

grant select on public.piece_ledger_moves to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Let a move suppress the per-row website-sync and activity-log triggers
--
-- Without this, moving a work would enqueue an "upsert" for the insert and a
-- "delete" for the removal — and unpublish it from the website. A move writes
-- its own single outbox row and its own single activity entry instead.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_piece_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _op text;
  _id uuid;
begin
  if coalesce(current_setting('jvb.ledger_move', true), '0') = '1' then
    return coalesce(new, old);    -- move_piece_ledger() enqueues once, itself
  end if;

  if tg_op = 'DELETE' then
    if not old.web_visible then
      return old;                 -- never published, nothing to sync
    end if;
    _op := 'delete';
    _id := old.id;
  elsif tg_op = 'INSERT' then
    if not new.web_visible then
      return new;
    end if;
    _op := 'upsert';
    _id := new.id;
  else -- UPDATE
    if new.web_visible then
      _op := 'upsert';            -- published now: push current state
    elsif old.web_visible then
      _op := 'delete';            -- just unpublished: remove from Sanity
    else
      return new;                 -- invisible before and after: ignore
    end if;
    _id := new.id;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  values ('piece', _id, _op);

  perform pg_notify('sync_outbox', _id::text);

  return coalesce(new, old);
end;
$$;

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
begin
  if coalesce(current_setting('jvb.ledger_move', true), '0') = '1' then
    return coalesce(new, old);    -- one "moved register" entry is written instead
  end if;

  _row := coalesce(to_jsonb(new), to_jsonb(old));
  -- pieces/crm_contacts/offers key on id; piece_financials keys on piece_id
  _entity_id := coalesce((_row ->> 'id')::uuid, (_row ->> 'piece_id')::uuid);

  if tg_op = 'INSERT' then
    _changes := jsonb_build_object('new', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    _changes := jsonb_build_object('old', to_jsonb(old));
  else
    -- Diff limited to changed keys; noise columns excluded.
    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
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

-- ---------------------------------------------------------------------------
-- 11. The move itself
--
-- The shared column list is read from the catalogue at call time, so adding a
-- column to both stock tables never requires editing this function.
-- ---------------------------------------------------------------------------
create or replace function public.move_piece_ledger(
  _piece_id uuid,
  _to       public.piece_ledger,
  _note     text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _from       public.piece_ledger;
  _src        text;
  _dst        text;
  _cols       text;
  _old_number text;
  _new_number text;
  _visible    boolean;
  _drift      int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only an administrator can move a record between registers';
  end if;

  select count(*) into _drift from public.vw_ledger_schema_drift;
  if _drift > 0 then
    raise exception
      'pieces and external_pieces differ by % column(s); fix the schema before moving records', _drift;
  end if;

  select ledger into _from from public.piece_ref where id = _piece_id;
  if _from is null then
    raise exception 'No such record';
  end if;
  if _from = _to then
    return null;                                  -- already where it belongs
  end if;

  if _to = 'jvb' then
    _src := 'external_pieces'; _dst := 'pieces';
  else
    _src := 'pieces';          _dst := 'external_pieces';
  end if;

  -- Once a sale has been recorded against a work it belongs to the stock book
  -- for good; it cannot retroactively become someone else's property.
  if _to = 'external'
     and exists (select 1 from public.piece_financials
                  where piece_id = _piece_id and sold_date is not null) then
    raise exception
      'This work has a recorded sale date, so it cannot be moved out of the stock book';
  end if;

  execute format('select stock_number, web_visible from public.%I where id = $1', _src)
    using _piece_id
    into _old_number, _visible;
  if _old_number is null then
    raise exception 'Record not found in the % register', _from;
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into _cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'pieces'
     and is_generated = 'NEVER'
     and identity_generation is null
     and column_name not in ('stock_number', 'ledger');

  -- One move, not a delete plus an unrelated insert.
  perform set_config('jvb.ledger_move', '1', true);

  if _to = 'jvb' then
    _new_number := public.next_stock_number(extract(year from now())::int);
  else
    _new_number := public.next_external_stock_number(extract(year from now())::int);
  end if;

  execute format(
    'insert into public.%I (%s, stock_number, ledger) select %s, $2, $3 from public.%I where id = $1',
    _dst, _cols, _cols, _src)
    using _piece_id, _new_number, _to;

  execute format('delete from public.%I where id = $1', _src) using _piece_id;

  update public.piece_ref set ledger = _to where id = _piece_id;

  insert into public.piece_ledger_moves
    (piece_id, from_ledger, to_ledger, from_stock_number, to_stock_number, note, moved_by)
  values
    (_piece_id, _from, _to, _old_number, _new_number, nullif(btrim(coalesce(_note, '')), ''), auth.uid());

  insert into public.activity_log (actor_id, entity_type, entity_id, action, changes)
  values (auth.uid(), _dst, _piece_id, 'UPDATE',
          jsonb_build_object(
            'ledger',       jsonb_build_object('old', _from,       'new', _to),
            'stock_number', jsonb_build_object('old', _old_number, 'new', _new_number)));

  if _visible then
    insert into public.sync_outbox (entity_type, entity_id, op) values ('piece', _piece_id, 'upsert');
    perform pg_notify('sync_outbox', _piece_id::text);
  end if;

  perform set_config('jvb.ledger_move', '0', true);

  return _new_number;
end;
$$;

comment on function public.move_piece_ledger(uuid, public.piece_ledger, text) is
  'Move a work between the JvdB and non-JvdB registers: copies the row to the '
  'other stock table under a number from that register''s series, deletes the '
  'original, and records the move. Satellites are untouched — they key on '
  'piece_ref, not on either stock table.';

revoke all on function public.move_piece_ledger(uuid, public.piece_ledger, text) from public;
grant execute on function public.move_piece_ledger(uuid, public.piece_ledger, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Reads that should span both registers
--
-- Every list, facet, export and search surface goes through one of these two,
-- so they pick up the second register without a single call site changing.
-- ---------------------------------------------------------------------------
create or replace view public.vw_pieces_list
with (security_invoker = true) as
with all_pieces as (
  select * from public.pieces
  union all
  select * from public.external_pieces
)
select
  p.id,
  p.stock_number,
  p.legacy_stock_number,
  p.legacy_stock_number_conflict,
  p.title,
  p.maker_id,
  m.display_name  as maker_name,
  p.category_id,
  c.name          as category_name,
  p.medium,
  p.period,
  p.origin_region,
  p.status,
  p.location_id,
  l.code          as location_code,
  p.web_visible,
  p.tags,
  (select pi.id
     from public.piece_images pi
    where pi.piece_id = p.id
    order by (pi.role <> 'front'), pi.sort_order, pi.created_at
    limit 1)      as primary_image_id,
  f.marked_price_gbp,
  case
    when f.purchase_date is not null
    then coalesce(f.sold_date, now()::date) - f.purchase_date
  end             as days_in_stock,
  p.created_at,
  p.updated_at,
  exists (
    select 1 from public.piece_shipments ps
    where ps.piece_id = p.id and ps.kind = 'temporary_export'
      and ps.returned_at is null and ps.closed_reason is null
  )               as on_temp_export,
  p.needs_completion,
  p.ledger,
  -- Surfaces that used to read straight from pieces and must now span both
  -- registers (related works by maker, the reverse embeds) need these here.
  p.year
from all_pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

-- Every column of a work, from either register, with the maker fields the
-- callers used to reach through a PostgREST embed. Satellites now key on
-- piece_ref, so there is no foreign key from `offer_items`, `piece_financials`
-- or `document_pieces` to either stock table for PostgREST to follow; those
-- surfaces fetch their piece ids and look the works up here instead.
create or replace view public.vw_pieces_all
with (security_invoker = true) as
select p.*,
       m.display_name as maker_name,
       m.life_dates   as maker_life_dates,
       c.name         as category_name,
       l.code         as location_code
  from (select * from public.pieces
        union all
        select * from public.external_pieces) p
  left join public.makers     m on m.id = p.maker_id
  left join public.categories c on c.id = p.category_id
  left join public.locations  l on l.id = p.location_id;

comment on view public.vw_pieces_all is
  'Full record for a work in either register. Read-only; writes go through the '
  'stock table that holds the row.';

grant select on public.vw_pieces_all to authenticated, service_role;

-- pieces_search still returns SETOF pieces: external_pieces was created with
-- LIKE, so the two row types are identical and the union is assignable.
create or replace function public.pieces_search(q text)
returns setof public.pieces
language sql
stable
set search_path = public
as $$
  with all_pieces as (
    select * from public.pieces
    union all
    select * from public.external_pieces
  )
  select p.*
  from all_pieces p
  left join public.makers m on m.id = p.maker_id
  where
    p.deleted_at is null
    and (
      p.search_vector @@ websearch_to_tsquery('english', q)
      or p.search_vector @@ websearch_to_tsquery('simple', q)
      or p.stock_number ilike q || '%'
      or p.legacy_stock_number ilike q || '%'
      or p.title ilike '%' || q || '%'
      or p.description ilike '%' || q || '%'
      or similarity(coalesce(p.title, ''), q) > 0.2
      or m.display_name ilike '%' || q || '%'
      or m.native_name ilike '%' || q || '%'
      or m.romanized_name ilike '%' || q || '%'
      or similarity(coalesce(m.display_name, ''), q) > 0.3
      or similarity(coalesce(m.romanized_name, ''), q) > 0.3
      or exists (
        select 1 from unnest(m.alt_names) an
        where an ilike '%' || q || '%' or similarity(an, q) > 0.3
      )
    )
  order by
    (p.stock_number = q or p.legacy_stock_number = q) desc,
    ts_rank(p.search_vector,
            websearch_to_tsquery('english', q)
            || websearch_to_tsquery('simple', q)) desc,
    greatest(
      similarity(coalesce(p.title, ''), q),
      similarity(coalesce(m.display_name, ''), q),
      similarity(coalesce(m.romanized_name, ''), q)
    ) desc,
    p.stock_number;
$$;

-- ---------------------------------------------------------------------------
-- 12b. Quick Capture files a whole purchase into one register
--
-- Set once on the batch, when the works are photographed, rather than per work
-- after the fact — that is how the decision actually arrives.
-- ---------------------------------------------------------------------------
alter table public.capture_batches
  add column if not exists ledger public.piece_ledger not null default 'jvb';

comment on column public.capture_batches.ledger is
  'Register the batch pushes into. Works pushed with ledger = external land in '
  'external_pieces and take a number from the X- series.';

-- ---------------------------------------------------------------------------
-- 13. Housekeeping must cover both registers
--
-- Both jobs run the same rules over each stock table in turn. The blank-draft
-- predicate is kept as a single piece of text rather than pasted twice, so the
-- two registers cannot drift apart on what counts as an abandoned draft.
-- ---------------------------------------------------------------------------
create or replace function public.purge_deleted_pieces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _tbl   text;
  _n     integer;
  _total integer := 0;
begin
  foreach _tbl in array array['pieces', 'external_pieces'] loop
    execute format(
      'with del as (delete from public.%I where deleted_at is not null '
      'and deleted_at < now() - interval ''30 days'' returning 1) '
      'select count(*) from del', _tbl)
      into _n;
    _total := _total + _n;
  end loop;
  return _total;
end;
$$;

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

notify pgrst, 'reload schema';

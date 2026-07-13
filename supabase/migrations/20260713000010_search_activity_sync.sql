-- 0010_search_activity_sync
-- Activity log (audit trail), full-text + fuzzy search, pgvector embeddings,
-- and the sync outbox that pushes web-visible pieces towards Sanity.

-- ===========================================================================
-- 1. Activity log
-- ===========================================================================
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,               -- auth.uid() when available (no FK: keep rows after user deletion)
  entity_type text not null,      -- trigger table name
  entity_id   uuid,
  action      text not null,      -- INSERT / UPDATE / DELETE
  changes     jsonb,              -- INSERT: {new}; DELETE: {old}; UPDATE: per-key {old,new} diff
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_log_entity
  on public.activity_log (entity_type, entity_id, created_at desc);

-- Generic audit trigger. SECURITY DEFINER: staff have no INSERT policy on
-- activity_log (it is append-only via triggers, readable by admin/accountant).
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

drop trigger if exists trg_log_pieces on public.pieces;
create trigger trg_log_pieces
  after insert or update or delete on public.pieces
  for each row execute function public.log_activity();

drop trigger if exists trg_log_piece_financials on public.piece_financials;
create trigger trg_log_piece_financials
  after insert or update or delete on public.piece_financials
  for each row execute function public.log_activity();

drop trigger if exists trg_log_crm_contacts on public.crm_contacts;
create trigger trg_log_crm_contacts
  after insert or update or delete on public.crm_contacts
  for each row execute function public.log_activity();

drop trigger if exists trg_log_offers on public.offers;
create trigger trg_log_offers
  after insert or update or delete on public.offers
  for each row execute function public.log_activity();

-- ===========================================================================
-- 2. Full-text search
-- ===========================================================================
-- Weighted generated tsvector. Only same-row columns are allowed in a
-- generated column (and to_tsvector is immutable only with an explicit,
-- fixed regconfig) — maker names are cross-table and therefore handled by
-- pieces_search() below instead.
alter table public.pieces
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple',
      coalesce(stock_number, '') || ' ' || coalesce(legacy_stock_number, '')), 'A')
    || setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english',
      coalesce(medium, '') || ' ' || coalesce(period, '') || ' ' || coalesce(origin_region, '')), 'B')
    || setweight(to_tsvector('english',
      coalesce(description, '') || ' ' || coalesce(signature_inscription, '') || ' ' || coalesce(box_notes, '')), 'C')
    || setweight(to_tsvector('english', coalesce(comments, '')), 'D')
  ) stored;

create index if not exists idx_pieces_search_vector
  on public.pieces using gin (search_vector);

-- Trigram indexes for fuzzy matching (typos, romanization variants)
create index if not exists idx_pieces_title_trgm
  on public.pieces using gin (title gin_trgm_ops);
create index if not exists idx_pieces_stock_number_trgm
  on public.pieces using gin (stock_number gin_trgm_ops);
create index if not exists idx_pieces_legacy_stock_number_trgm
  on public.pieces using gin (legacy_stock_number gin_trgm_ops);
create index if not exists idx_makers_display_name_trgm
  on public.makers using gin (display_name gin_trgm_ops);
create index if not exists idx_makers_romanized_name_trgm
  on public.makers using gin (romanized_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- pieces_search(q): FTS + trigram fuzziness + maker-name matching in one
-- call, rank-ordered. SECURITY INVOKER on purpose — results are filtered by
-- the caller's own RLS visibility on pieces.
-- ---------------------------------------------------------------------------
create or replace function public.pieces_search(q text)
returns setof public.pieces
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.pieces p
  left join public.makers m on m.id = p.maker_id
  where
    -- full-text (english for prose, simple for stock numbers)
    p.search_vector @@ websearch_to_tsquery('english', q)
    or p.search_vector @@ websearch_to_tsquery('simple', q)
    -- exact / prefix stock-number hits
    or p.stock_number ilike q || '%'
    or p.legacy_stock_number ilike q || '%'
    -- fuzzy title
    or similarity(coalesce(p.title, ''), q) > 0.25
    -- maker names: substring + trigram similarity across all name forms
    or m.display_name ilike '%' || q || '%'
    or m.native_name ilike '%' || q || '%'
    or m.romanized_name ilike '%' || q || '%'
    or similarity(coalesce(m.display_name, ''), q) > 0.3
    or similarity(coalesce(m.romanized_name, ''), q) > 0.3
    or exists (
      select 1 from unnest(m.alt_names) an
      where an ilike '%' || q || '%' or similarity(an, q) > 0.3
    )
  order by
    -- exact stock-number hits first
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

comment on function public.pieces_search(text) is
  'Omnisearch over pieces: FTS (weighted) + pg_trgm fuzzy + maker names '
  '(display/native/romanized/alt). Semantic (pgvector) results are blended '
  'in application code via piece_embeddings.';

-- ===========================================================================
-- 3. Semantic search embeddings (pgvector)
-- ===========================================================================
-- text_embedding : 1024-dim (Voyage AI voyage-3 family) over assembled catalogue text
-- image_embedding: 512-dim CLIP (ViT-B/32) computed in infra/image-worker
create table if not exists public.piece_embeddings (
  piece_id        uuid primary key references public.pieces (id) on delete cascade,
  text_embedding  vector(1024),
  image_embedding vector(512),
  model           text,
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_piece_embeddings_updated_at on public.piece_embeddings;
create trigger trg_piece_embeddings_updated_at
  before update on public.piece_embeddings
  for each row execute function public.set_updated_at();

-- HNSW preferred (no training-data requirement, better recall); fall back to
-- ivfflat on older pgvector; skip with a notice if neither is available.
do $$
begin
  begin
    create index if not exists idx_piece_embeddings_text_hnsw
      on public.piece_embeddings using hnsw (text_embedding vector_cosine_ops);
    create index if not exists idx_piece_embeddings_image_hnsw
      on public.piece_embeddings using hnsw (image_embedding vector_cosine_ops);
  exception
    when others then
      begin
        create index if not exists idx_piece_embeddings_text_ivf
          on public.piece_embeddings using ivfflat (text_embedding vector_cosine_ops) with (lists = 40);
        create index if not exists idx_piece_embeddings_image_ivf
          on public.piece_embeddings using ivfflat (image_embedding vector_cosine_ops) with (lists = 40);
      exception
        when others then
          raise notice 'pgvector ANN indexes unavailable, skipping (sequential scan still works at this scale)';
      end;
  end;
end;
$$;

-- ===========================================================================
-- 4. Sync outbox (Supabase -> Sanity webhook pattern)
-- ===========================================================================
-- Triggers write rows here; pg_net (or the studio route woken by NOTIFY)
-- POSTs them to Vercel immediately; a Vercel cron drains stragglers.
create table if not exists public.sync_outbox (
  id           bigint generated always as identity primary key,
  entity_type  text not null,     -- 'piece'
  entity_id    uuid not null,
  op           text not null,     -- 'upsert' | 'delete'
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_sync_outbox_unprocessed
  on public.sync_outbox (created_at) where processed_at is null;

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

drop trigger if exists trg_pieces_sync_outbox on public.pieces;
create trigger trg_pieces_sync_outbox
  after insert or update or delete on public.pieces
  for each row execute function public.enqueue_piece_sync();

-- Image changes re-sync their (web-visible) piece.
create or replace function public.enqueue_piece_image_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _piece_id    uuid;
  _web_visible boolean;
begin
  _piece_id := coalesce(new.piece_id, old.piece_id);

  select p.web_visible into _web_visible
  from public.pieces p
  where p.id = _piece_id;

  if coalesce(_web_visible, false) then
    insert into public.sync_outbox (entity_type, entity_id, op)
    values ('piece', _piece_id, 'upsert');

    perform pg_notify('sync_outbox', _piece_id::text);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_piece_images_sync_outbox on public.piece_images;
create trigger trg_piece_images_sync_outbox
  after insert or update or delete on public.piece_images
  for each row execute function public.enqueue_piece_image_sync();

-- 0004_stock_numbering
-- Year + sequence stock numbers ("2026-0001"), assigned by trigger on insert.
-- A per-year counter row plus a transaction-scoped advisory lock guarantees
-- gapless-enough, race-free allocation without serializing all inserts.

create table if not exists public.stock_number_counters (
  year     int primary key,
  last_seq int not null default 0
);

comment on table public.stock_number_counters is
  'Per-year sequence for stock numbers. Migration seeds counters above the '
  'maxima of migrated legacy records so new numbers never collide.';

-- ---------------------------------------------------------------------------
-- next_stock_number(year) -> '2026-0001'
-- pg_advisory_xact_lock takes a bigint; hashtext() (int4, implicitly cast)
-- derives a stable key from a namespaced string per year.
-- ---------------------------------------------------------------------------
create or replace function public.next_stock_number(_year int)
returns text
language plpgsql
security definer            -- staff insert pieces but have no direct grant/policy on the counters table
set search_path = public
as $$
declare
  _seq int;
begin
  -- Serialize allocation per year for the duration of this transaction only.
  perform pg_advisory_xact_lock(hashtext('stock_number' || _year::text));

  insert into public.stock_number_counters as c (year, last_seq)
  values (_year, 1)
  on conflict (year)
  do update set last_seq = c.last_seq + 1
  returning last_seq into _seq;

  return format('%s-%s', _year, lpad(_seq::text, 4, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT trigger: assign a number when none supplied.
-- Explicit stock numbers (e.g. purchase-year series set by the FileMaker
-- migration) pass through untouched.
-- ---------------------------------------------------------------------------
create or replace function public.assign_stock_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock_number is null or new.stock_number = '' then
    new.stock_number := public.next_stock_number(extract(year from now())::int);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pieces_assign_stock_number on public.pieces;
create trigger trg_pieces_assign_stock_number
  before insert on public.pieces
  for each row execute function public.assign_stock_number();

-- stock_number is declared NOT NULL; the trigger fills it, but inserts that
-- pass '' explicitly are also covered. Nothing else to do here.

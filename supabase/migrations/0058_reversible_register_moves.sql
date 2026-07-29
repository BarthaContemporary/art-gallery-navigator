-- 0058_reversible_register_moves
--
-- Two changes to move_piece_ledger, both so that a move made in error can be
-- undone cleanly.
--
-- 1. A recorded sale no longer blocks a move out of the stock book.
--    0056 refused it on the grounds that a sold work belongs to the stock book
--    for good. That is right about the accounting and wrong about the mistake:
--    if a work was filed in the wrong register to begin with, the sale is
--    recorded against the wrong record too, and the block left no way back.
--    The move is still logged in piece_ledger_moves and activity_log, so a
--    work leaving the stock book after a sale is visible rather than silent.
--
-- 2. Moving a work back restores the stock number it had before.
--    Without this, undoing a move issues a third number: 2026-0500 → X-2026-0003
--    → 2026-1089, and the original number is gone. That is not an undo, and for
--    a work that has been sold it is actively harmful — the accountant's
--    records, invoices and any filed VAT return all name 2026-0500, so it must
--    come back as 2026-0500, not as what would look like a new item.
--
--    The old number is only reused for the work that held it, and only while no
--    record in either register carries it. Numbers are still never handed to a
--    different work.

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
  _restore    text;
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

  -- The number this work last carried in the register it is returning to.
  select m.from_stock_number
    into _restore
    from public.piece_ledger_moves m
   where m.piece_id   = _piece_id
     and m.from_ledger = _to
   order by m.moved_at desc
   limit 1;

  if _restore is not null
     and not exists (select 1 from public.pieces          where stock_number = _restore)
     and not exists (select 1 from public.external_pieces where stock_number = _restore)
  then
    -- Undoing a move: the record comes back as itself.
    _new_number := _restore;
  elsif _to = 'jvb' then
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
  'other stock table, deletes the original, and records the move. Always '
  'reversible — moving back restores the stock number the work had before, so '
  'an undo leaves no trace beyond the move log. Satellites are untouched.';

revoke all on function public.move_piece_ledger(uuid, public.piece_ledger, text) from public;
revoke all on function public.move_piece_ledger(uuid, public.piece_ledger, text) from anon;
grant execute on function public.move_piece_ledger(uuid, public.piece_ledger, text) to authenticated;

notify pgrst, 'reload schema';

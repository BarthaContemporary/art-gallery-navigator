-- Promote the remaining FileMaker fields that had no dedicated home into
-- editable columns, and backfill them from the raw audit snapshot
-- (legacy_filemaker_rows.raw). Every original FileMaker column is now either a
-- first-class column or preserved verbatim in legacy_filemaker_rows.
--
-- FileMaker field            -> destination
--   Manufacturer (source)    -> pieces.source_note
--   Published                -> pieces.published_note
--   Shares                   -> pieces.shares_note
--   Consignment details      -> pieces.consignment_details
--   purchased from (empty)   -> pieces.purchased_from
--   sold to (empty)          -> pieces.sold_to
--   Document (empty)         -> pieces.document_note
--   Photograper              -> pieces.photographer (backfill any missed)
--   Date Modified            -> pieces.legacy_modified_at
--   Modified By              -> pieces.legacy_modified_by
--   Net profit               -> piece_financials.net_profit_gbp
--   Profit                   -> piece_financials.legacy_profit_gbp

alter table public.pieces
  add column if not exists source_note          text,
  add column if not exists published_note        text,
  add column if not exists shares_note           text,
  add column if not exists consignment_details   text,
  add column if not exists purchased_from        text,
  add column if not exists sold_to               text,
  add column if not exists document_note         text,
  add column if not exists legacy_modified_at    timestamptz,
  add column if not exists legacy_modified_by    text;

alter table public.piece_financials
  add column if not exists net_profit_gbp    numeric,
  add column if not exists legacy_profit_gbp numeric;

-- ---------------------------------------------------------------------------
-- Backfill from the raw FileMaker snapshot (same database).
-- ---------------------------------------------------------------------------
update public.pieces p
set
  source_note        = nullif(btrim(r.raw->>'Manufacturer'), ''),
  published_note     = nullif(btrim(r.raw->>'Published'), ''),
  shares_note        = nullif(btrim(r.raw->>'Shares'), ''),
  consignment_details= nullif(btrim(r.raw->>'Consignment details'), ''),
  purchased_from     = nullif(btrim(r.raw->>'purchased from'), ''),
  sold_to            = nullif(btrim(r.raw->>'sold to'), ''),
  document_note      = nullif(btrim(r.raw->>'Document'), ''),
  photographer       = coalesce(p.photographer, nullif(btrim(r.raw->>'Photograper'), '')),
  legacy_modified_by = nullif(btrim(r.raw->>'Modified By'), ''),
  legacy_modified_at = case
      when btrim(coalesce(r.raw->>'Date Modified','')) ~ '^\d{4}-\d{2}-\d{2}'
      then (btrim(r.raw->>'Date Modified'))::timestamptz
      else null
    end
from public.legacy_filemaker_rows r
where r.piece_id = p.id;

update public.piece_financials pf
set
  net_profit_gbp    = nullif(btrim(r.raw->>'Net profit'), '')::numeric,
  legacy_profit_gbp = nullif(btrim(r.raw->>'Profit'), '')::numeric
from public.legacy_filemaker_rows r
where r.piece_id = pf.piece_id
  and btrim(coalesce(r.raw->>'Net profit','')) ~ '^-?\d'
  and btrim(coalesce(r.raw->>'Profit','')) ~ '^-?\d';

-- Refresh PostgREST so the new columns are immediately usable.
notify pgrst, 'reload schema';

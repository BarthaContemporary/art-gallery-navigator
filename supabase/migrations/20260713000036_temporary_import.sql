-- 0036_temporary_import
-- A fourth shipment kind: 'temporary_import' (goods brought in temporarily —
-- e.g. for a UK exhibition/fair). Recorded like an import (date, reference,
-- notes, documents, inventory items); a piece may be on several over time
-- (piece_shipments PK is piece_id+shipment_id; the one-per-kind unique index
-- only covers import/export, so no extra index change is needed).

alter type public.shipment_kind add value if not exists 'temporary_import';

notify pgrst, 'reload schema';

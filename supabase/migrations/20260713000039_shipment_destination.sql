-- 0039_shipment_destination
-- Destination country for export / temporary-export shipments (where the work
-- is going). Nullable; not relevant for imports.

alter table public.shipments
  add column if not exists destination_country text;

notify pgrst, 'reload schema';

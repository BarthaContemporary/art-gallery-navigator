-- Drift: the live database received this enum value by hand ("added
-- separately", per the migration's own header); no migration adds it.
alter type public.shipment_kind add value if not exists 'temporary_export';

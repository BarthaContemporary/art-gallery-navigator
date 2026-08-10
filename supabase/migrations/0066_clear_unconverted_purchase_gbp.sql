-- ---------------------------------------------------------------------------
-- Clear purchase £ figures that are really an un-converted foreign amount.
--
-- purchase_cost_gbp is entered by hand — nothing auto-converts it (only the
-- sale side takes a spot rate). The FileMaker import nonetheless copied the
-- raw purchase amount into it whatever the currency, so a ¥500,000 purchase
-- reads as £500,000 in the Stock Book.
--
-- It is not only a display fault. total_cost_gbp and margin_gbp are generated
-- columns over purchase_cost_gbp, and margin-scheme VAT is 1/6 of
-- (sale − total cost), so the same wrong number reaches total cost, margin,
-- margin % and VAT due. Clearing the column makes all four recompute.
--
-- Nothing is destroyed: purchase_cost and purchase_currency still hold the
-- amount actually paid, and every cleared value is recorded below so the
-- change can be inspected, reversed, or worked through as a to-do list.
--
-- The test for "never actually converted" is deliberately narrow: a non-GBP
-- purchase whose £ figure is identical to the foreign amount. A row where
-- someone typed a real £ figure differs from the foreign amount and is left
-- alone, as is any row with no foreign amount to compare against.
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_gbp_cleared (
  piece_id       uuid primary key references public.piece_ref (id) on delete cascade,
  cleared_value  numeric not null,   -- what purchase_cost_gbp held
  purchase_cost  numeric,            -- the amount actually paid
  currency       text not null,      -- the currency it was paid in
  cleared_at     timestamptz not null default now()
);

comment on table public.purchase_gbp_cleared is
  'Works whose purchase £ was an un-converted foreign amount and has been '
  'cleared. Each row is a work still needing a real £ purchase figure.';

alter table public.purchase_gbp_cleared enable row level security;

drop policy if exists admin_all on public.purchase_gbp_cleared;
create policy admin_all on public.purchase_gbp_cleared
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists accountant_select on public.purchase_gbp_cleared;
create policy accountant_select on public.purchase_gbp_cleared
  for select to authenticated
  using (public.has_role(auth.uid(), 'accountant'));

-- Record before clearing, so the two can never disagree.
insert into public.purchase_gbp_cleared (piece_id, cleared_value, purchase_cost, currency)
select f.piece_id, f.purchase_cost_gbp, f.purchase_cost, f.purchase_currency
  from public.piece_financials f
 where f.purchase_currency <> 'GBP'
   and f.purchase_cost_gbp is not null
   and f.purchase_cost is not null
   and f.purchase_cost_gbp = f.purchase_cost
on conflict (piece_id) do nothing;

update public.piece_financials f
   set purchase_cost_gbp = null,
       -- The fx rate said 1, which is what made the copy look like a
       -- conversion. Leave it at its default rather than asserting a rate
       -- nobody supplied.
       purchase_fx = 1
  from public.purchase_gbp_cleared c
 where c.piece_id = f.piece_id
   and f.purchase_cost_gbp is not null;

notify pgrst, 'reload schema';

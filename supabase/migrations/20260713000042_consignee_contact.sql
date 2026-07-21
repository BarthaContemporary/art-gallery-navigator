-- 0042_consignee_contact
-- Let the Co-owner / consignee on a consignment be a real CRM contact, not just
-- a free-text name. Nullable link; the existing pieces.shares_note keeps the
-- display name (and still works for consignees not in the CRM).

alter table public.pieces
  add column if not exists consignee_contact_id uuid references public.crm_contacts(id) on delete set null;

notify pgrst, 'reload schema';

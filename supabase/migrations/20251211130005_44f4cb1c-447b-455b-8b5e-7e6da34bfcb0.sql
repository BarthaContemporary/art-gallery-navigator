-- Add VAT and EORI fields to crm_organizations
ALTER TABLE public.crm_organizations 
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS vat_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS eori_number text,
ADD COLUMN IF NOT EXISTS eori_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS eori_verified_at timestamp with time zone;
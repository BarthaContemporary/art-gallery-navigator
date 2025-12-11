-- Add company number fields to crm_organizations
ALTER TABLE public.crm_organizations
ADD COLUMN IF NOT EXISTS company_number text,
ADD COLUMN IF NOT EXISTS company_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS company_verified_at timestamp with time zone;
-- Add sanctions check fields to crm_contacts
ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS sanctions_checked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS sanctions_risk_level text,
ADD COLUMN IF NOT EXISTS sanctions_match_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sanctions_matches jsonb DEFAULT '[]'::jsonb;
-- Add secondary_phone column for mobile number
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS secondary_phone TEXT;
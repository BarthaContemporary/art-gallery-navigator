
-- Add Instagram and LinkedIn handle columns to the clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS linkedin_handle text;

-- Create indexes for better performance on the new columns
CREATE INDEX IF NOT EXISTS idx_clients_instagram_handle ON public.clients(instagram_handle) WHERE instagram_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_linkedin_handle ON public.clients(linkedin_handle) WHERE linkedin_handle IS NOT NULL;


-- Add ip_address column to publication_leads for IP-based rate limiting
ALTER TABLE public.publication_leads 
ADD COLUMN IF NOT EXISTS ip_address text;

-- Create an index for efficient IP-based rate limit queries
CREATE INDEX IF NOT EXISTS idx_publication_leads_ip_address_created 
ON public.publication_leads(ip_address, created_at DESC)
WHERE ip_address IS NOT NULL;

-- Create an index for efficient email-based rate limit queries
CREATE INDEX IF NOT EXISTS idx_publication_leads_email_pub_created 
ON public.publication_leads(email, publication_id, created_at DESC);

-- Create an index for efficient publication-based rate limit queries  
CREATE INDEX IF NOT EXISTS idx_publication_leads_pub_created 
ON public.publication_leads(publication_id, created_at DESC);

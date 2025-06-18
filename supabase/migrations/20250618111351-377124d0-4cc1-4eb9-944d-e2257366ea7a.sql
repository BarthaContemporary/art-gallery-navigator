
-- Add the missing interested_artists column to the clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS interested_artists text[] DEFAULT ARRAY[]::text[];

-- Create index for better performance on the new column
CREATE INDEX IF NOT EXISTS idx_clients_interested_artists ON public.clients USING GIN(interested_artists);

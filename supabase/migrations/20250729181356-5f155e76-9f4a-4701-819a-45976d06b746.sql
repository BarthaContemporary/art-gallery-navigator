-- Create exchange_rates table for caching currency exchange rates
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate DECIMAL(12, 6) NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index to prevent duplicate rate entries
CREATE UNIQUE INDEX idx_exchange_rates_currencies ON public.exchange_rates (base_currency, target_currency);

-- Index for faster lookup
CREATE INDEX idx_exchange_rates_expires ON public.exchange_rates (expires_at);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read exchange rates (they're public data)
CREATE POLICY "Anyone can view exchange rates" 
ON public.exchange_rates 
FOR SELECT 
USING (true);

-- Only allow system (service role) to insert/update rates
CREATE POLICY "System can manage exchange rates" 
ON public.exchange_rates 
FOR ALL 
USING (auth.role() = 'service_role' OR auth.uid() IS NULL);

-- Create function to get available currencies from artworks
CREATE OR REPLACE FUNCTION public.get_available_currencies()
RETURNS TEXT[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ARRAY(
    SELECT DISTINCT currency 
    FROM public.artworks 
    WHERE currency IS NOT NULL 
    ORDER BY currency
  );
$function$;
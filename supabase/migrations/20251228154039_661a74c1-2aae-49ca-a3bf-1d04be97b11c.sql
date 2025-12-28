-- Create CRM deal items table for line item calculations
CREATE TABLE public.crm_deal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5, 2) DEFAULT 0,
  tax_percent NUMERIC(5, 2) DEFAULT 0,
  artwork_id UUID REFERENCES public.artworks(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.crm_deal_items ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM deal items (only authenticated users)
CREATE POLICY "Authenticated users can view deal items"
ON public.crm_deal_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create deal items"
ON public.crm_deal_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal items"
ON public.crm_deal_items
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete deal items"
ON public.crm_deal_items
FOR DELETE
TO authenticated
USING (true);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_crm_deal_items_updated_at
BEFORE UPDATE ON public.crm_deal_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_crm_deal_items_deal_id ON public.crm_deal_items(deal_id);

-- Add probability and expected_close_date to deals if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crm_deals' AND column_name = 'probability') THEN
    ALTER TABLE public.crm_deals ADD COLUMN probability NUMERIC(5, 2) DEFAULT 0;
  END IF;
END $$;
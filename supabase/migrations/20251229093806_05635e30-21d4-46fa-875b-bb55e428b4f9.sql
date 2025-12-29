-- Create junction table for deal-contact many-to-many relationship
CREATE TABLE public.crm_deal_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  role TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deal_id, contact_id)
);

-- Enable Row Level Security
ALTER TABLE public.crm_deal_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (same as other CRM tables - authenticated users have full access)
CREATE POLICY "Authenticated users can view deal contacts"
ON public.crm_deal_contacts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create deal contacts"
ON public.crm_deal_contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal contacts"
ON public.crm_deal_contacts
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete deal contacts"
ON public.crm_deal_contacts
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_crm_deal_contacts_deal_id ON public.crm_deal_contacts(deal_id);
CREATE INDEX idx_crm_deal_contacts_contact_id ON public.crm_deal_contacts(contact_id);

-- Migrate existing contact_id data to the new junction table
INSERT INTO public.crm_deal_contacts (deal_id, contact_id, is_primary, display_order)
SELECT id, contact_id, true, 0
FROM public.crm_deals
WHERE contact_id IS NOT NULL;
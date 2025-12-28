-- Create junction table for contact-organization many-to-many relationship
CREATE TABLE public.crm_contact_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  role TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, organization_id)
);

-- Create table for deal-specific interactions/touchpoints
CREATE TABLE public.crm_deal_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'note',
  direction TEXT,
  subject TEXT,
  summary TEXT,
  interaction_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.crm_contact_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_contact_organizations
CREATE POLICY "Authenticated users can view contact organizations"
  ON public.crm_contact_organizations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contact organizations"
  ON public.crm_contact_organizations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact organizations"
  ON public.crm_contact_organizations FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete contact organizations"
  ON public.crm_contact_organizations FOR DELETE
  TO authenticated USING (true);

-- RLS policies for crm_deal_interactions
CREATE POLICY "Authenticated users can view deal interactions"
  ON public.crm_deal_interactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert deal interactions"
  ON public.crm_deal_interactions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal interactions"
  ON public.crm_deal_interactions FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete deal interactions"
  ON public.crm_deal_interactions FOR DELETE
  TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX idx_crm_contact_organizations_contact ON public.crm_contact_organizations(contact_id);
CREATE INDEX idx_crm_contact_organizations_org ON public.crm_contact_organizations(organization_id);
CREATE INDEX idx_crm_deal_interactions_deal ON public.crm_deal_interactions(deal_id);
CREATE INDEX idx_crm_deal_interactions_contact ON public.crm_deal_interactions(contact_id);

-- Add trigger for updated_at on deal_interactions
CREATE TRIGGER update_crm_deal_interactions_updated_at
  BEFORE UPDATE ON public.crm_deal_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
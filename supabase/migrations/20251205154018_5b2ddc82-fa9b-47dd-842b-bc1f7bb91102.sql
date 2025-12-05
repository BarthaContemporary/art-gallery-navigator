-- =============================================
-- CRM REDESIGN: Complete Database Schema
-- =============================================

-- Create enum for contact types
CREATE TYPE crm_contact_type AS ENUM ('collector', 'curator', 'press', 'institution', 'artist', 'advisor', 'vip', 'prospect', 'other');

-- Create enum for organization types
CREATE TYPE crm_organization_type AS ENUM ('gallery', 'museum', 'foundation', 'fair', 'press', 'corporation', 'auction_house', 'other');

-- Create enum for interaction types
CREATE TYPE crm_interaction_type AS ENUM ('email', 'call', 'meeting', 'instagram_dm', 'whatsapp', 'wechat', 'line', 'note', 'task', 'other');

-- Create enum for interaction direction
CREATE TYPE crm_interaction_direction AS ENUM ('inbound', 'outbound', 'internal');

-- Create enum for list types
CREATE TYPE crm_list_type AS ENUM ('static', 'dynamic');

-- Create enum for campaign status
CREATE TYPE crm_campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'archived');

-- Create enum for deal status
CREATE TYPE crm_deal_status AS ENUM ('open', 'won', 'lost');

-- =============================================
-- 1. CRM Organizations Table
-- =============================================
CREATE TABLE public.crm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type crm_organization_type DEFAULT 'other',
  website TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. CRM Contacts Table
-- =============================================
CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  secondary_email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  instagram_handle TEXT,
  linkedin_handle TEXT,
  whatsapp_number TEXT,
  line_id TEXT,
  wechat_id TEXT,
  job_title TEXT,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  contact_type crm_contact_type DEFAULT 'prospect',
  status TEXT DEFAULT 'active',
  source TEXT,
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  interested_artists UUID[] DEFAULT '{}',
  marketing_consent BOOLEAN DEFAULT false,
  consent_date TIMESTAMPTZ,
  consent_source TEXT,
  google_contact_id TEXT,
  last_interaction_date TIMESTAMPTZ,
  birthday DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- 3. CRM Interactions Table
-- =============================================
CREATE TABLE public.crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  type crm_interaction_type NOT NULL DEFAULT 'note',
  direction crm_interaction_direction DEFAULT 'outbound',
  subject TEXT,
  summary TEXT,
  notes TEXT,
  interaction_date TIMESTAMPTZ DEFAULT now(),
  duration_minutes INTEGER,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  calendar_event_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. CRM Lists Table
-- =============================================
CREATE TABLE public.crm_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type crm_list_type DEFAULT 'static',
  filter_rules JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- 5. CRM List Members Table
-- =============================================
CREATE TABLE public.crm_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES public.crm_lists(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(list_id, contact_id)
);

-- =============================================
-- 6. CRM Campaigns Table
-- =============================================
CREATE TABLE public.crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  list_id UUID REFERENCES public.crm_lists(id) ON DELETE SET NULL,
  audience_snapshot JSONB,
  subject TEXT,
  preview_text TEXT,
  from_name TEXT,
  from_email TEXT,
  status crm_campaign_status DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- 7. CRM Pipelines Tables
-- =============================================
CREATE TABLE public.crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  value NUMERIC,
  currency TEXT DEFAULT 'GBP',
  probability INTEGER,
  expected_close_date DATE,
  status crm_deal_status DEFAULT 'open',
  related_artworks UUID[] DEFAULT '{}',
  related_exhibitions TEXT,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- 8. CRM Export History Table
-- =============================================
CREATE TABLE public.crm_export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  source_name TEXT,
  record_count INTEGER,
  google_sheet_id TEXT,
  google_sheet_url TEXT,
  exported_by UUID REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 9. CRM Integration Config Table
-- =============================================
CREATE TABLE public.crm_integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,
  google_scopes TEXT[],
  auto_sync_contacts BOOLEAN DEFAULT false,
  auto_log_emails BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_integration_config ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies - Admin only access
-- =============================================
CREATE POLICY "crm_organizations_admin_only" ON public.crm_organizations
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_contacts_admin_only" ON public.crm_contacts
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_interactions_admin_only" ON public.crm_interactions
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_lists_admin_only" ON public.crm_lists
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_list_members_admin_only" ON public.crm_list_members
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_campaigns_admin_only" ON public.crm_campaigns
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_pipelines_admin_only" ON public.crm_pipelines
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_pipeline_stages_admin_only" ON public.crm_pipeline_stages
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_deals_admin_only" ON public.crm_deals
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_export_history_admin_only" ON public.crm_export_history
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_integration_config_own_only" ON public.crm_integration_config
  FOR ALL USING (auth.uid() = user_id AND has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'gallery_admin'::user_role));

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX idx_crm_contacts_email ON public.crm_contacts(email);
CREATE INDEX idx_crm_contacts_organization ON public.crm_contacts(organization_id);
CREATE INDEX idx_crm_contacts_type ON public.crm_contacts(contact_type);
CREATE INDEX idx_crm_contacts_tags ON public.crm_contacts USING GIN(tags);
CREATE INDEX idx_crm_contacts_full_name ON public.crm_contacts(full_name);
CREATE INDEX idx_crm_interactions_contact ON public.crm_interactions(contact_id);
CREATE INDEX idx_crm_interactions_date ON public.crm_interactions(interaction_date);
CREATE INDEX idx_crm_list_members_list ON public.crm_list_members(list_id);
CREATE INDEX idx_crm_list_members_contact ON public.crm_list_members(contact_id);
CREATE INDEX idx_crm_deals_pipeline ON public.crm_deals(pipeline_id);
CREATE INDEX idx_crm_deals_stage ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_contact ON public.crm_deals(contact_id);

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE TRIGGER update_crm_organizations_updated_at
  BEFORE UPDATE ON public.crm_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_interactions_updated_at
  BEFORE UPDATE ON public.crm_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_lists_updated_at
  BEFORE UPDATE ON public.crm_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_campaigns_updated_at
  BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_integration_config_updated_at
  BEFORE UPDATE ON public.crm_integration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Insert Default Pipeline
-- =============================================
INSERT INTO public.crm_pipelines (id, name, description, display_order) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Sales Pipeline', 'Default sales pipeline for artwork opportunities', 0);

INSERT INTO public.crm_pipeline_stages (pipeline_id, name, display_order, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Lead', 0, '#6B7280'),
  ('00000000-0000-0000-0000-000000000001', 'Qualified', 1, '#3B82F6'),
  ('00000000-0000-0000-0000-000000000001', 'Proposal', 2, '#F59E0B'),
  ('00000000-0000-0000-0000-000000000001', 'Negotiation', 3, '#8B5CF6'),
  ('00000000-0000-0000-0000-000000000001', 'Won', 4, '#10B981'),
  ('00000000-0000-0000-0000-000000000001', 'Lost', 5, '#EF4444');

-- =============================================
-- Data Migration from existing tables
-- =============================================

-- Migrate clients to crm_contacts
INSERT INTO public.crm_contacts (
  id,
  full_name,
  email,
  phone,
  address_line1,
  birthday,
  tags,
  notes,
  source,
  instagram_handle,
  linkedin_handle,
  marketing_consent,
  last_interaction_date,
  created_at,
  updated_at,
  contact_type,
  status
)
SELECT 
  id,
  full_name,
  email,
  phone,
  address,
  birthday,
  COALESCE(tags, '{}'),
  notes,
  source,
  instagram_handle,
  linkedin_handle,
  true,
  last_activity_date,
  created_at,
  updated_at,
  CASE 
    WHEN client_type = 'collector' THEN 'collector'::crm_contact_type
    WHEN client_type = 'curator' THEN 'curator'::crm_contact_type
    WHEN client_type = 'press' THEN 'press'::crm_contact_type
    WHEN client_type = 'institution' THEN 'institution'::crm_contact_type
    ELSE 'other'::crm_contact_type
  END,
  CASE 
    WHEN status::text = 'customer' THEN 'active'
    WHEN status::text = 'prospect' THEN 'active'
    WHEN status::text = 'lead' THEN 'active'
    WHEN status::text = 'inactive' THEN 'inactive'
    ELSE 'active'
  END
FROM public.clients
ON CONFLICT (id) DO NOTHING;

-- Migrate client_lists to crm_lists
INSERT INTO public.crm_lists (
  id,
  name,
  description,
  type,
  display_order,
  created_at,
  updated_at
)
SELECT 
  id,
  name,
  description,
  'static'::crm_list_type,
  0,
  created_at,
  updated_at
FROM public.client_lists
ON CONFLICT (id) DO NOTHING;

-- Migrate client_list_members to crm_list_members
INSERT INTO public.crm_list_members (
  id,
  list_id,
  contact_id,
  added_at
)
SELECT 
  id,
  list_id,
  client_id,
  added_at
FROM public.client_list_members
WHERE EXISTS (SELECT 1 FROM public.crm_contacts WHERE id = client_id)
  AND EXISTS (SELECT 1 FROM public.crm_lists WHERE id = list_id)
ON CONFLICT (list_id, contact_id) DO NOTHING;

-- Migrate client_communications to crm_interactions
INSERT INTO public.crm_interactions (
  id,
  contact_id,
  type,
  subject,
  notes,
  interaction_date,
  created_at,
  updated_at,
  created_by
)
SELECT 
  id,
  client_id,
  CASE 
    WHEN type::text = 'email' THEN 'email'::crm_interaction_type
    WHEN type::text = 'phone' THEN 'call'::crm_interaction_type
    WHEN type::text = 'meeting' THEN 'meeting'::crm_interaction_type
    ELSE 'note'::crm_interaction_type
  END,
  subject,
  content,
  COALESCE(completed_date, scheduled_date, created_at),
  created_at,
  updated_at,
  created_by
FROM public.client_communications
WHERE EXISTS (SELECT 1 FROM public.crm_contacts WHERE id = client_id)
ON CONFLICT (id) DO NOTHING;

-- Create enum for client status
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'prospect', 'lead', 'customer');

-- Create enum for communication types
CREATE TYPE public.communication_type AS ENUM ('email', 'phone', 'meeting', 'note', 'campaign');

-- Enhance the existing clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS status client_status DEFAULT 'prospect',
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS birthday date,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS campaign_monitor_id text,
ADD COLUMN IF NOT EXISTS last_activity_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[];

-- Create client communications table
CREATE TABLE IF NOT EXISTS public.client_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  type communication_type NOT NULL,
  subject text,
  content text,
  scheduled_date timestamp with time zone,
  completed_date timestamp with time zone,
  campaign_monitor_campaign_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create campaign monitor lists table
CREATE TABLE IF NOT EXISTS public.campaign_monitor_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  subscriber_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create client list subscriptions table
CREATE TABLE IF NOT EXISTS public.client_list_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  list_id uuid REFERENCES public.campaign_monitor_lists(id) ON DELETE CASCADE NOT NULL,
  subscribed_at timestamp with time zone DEFAULT now(),
  unsubscribed_at timestamp with time zone,
  is_active boolean DEFAULT true,
  UNIQUE(client_id, list_id)
);

-- Enable RLS on new tables
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_monitor_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for client_communications (admin only)
CREATE POLICY "Admins can manage client communications"
  ON public.client_communications
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Create RLS policies for campaign_monitor_lists (admin only)
CREATE POLICY "Admins can manage campaign monitor lists"
  ON public.campaign_monitor_lists
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Create RLS policies for client_list_subscriptions (admin only)
CREATE POLICY "Admins can manage client list subscriptions"
  ON public.client_list_subscriptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Update existing clients table RLS policy to allow admin access
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
CREATE POLICY "Admins can manage clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_tags ON public.clients USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_clients_campaign_monitor_id ON public.clients(campaign_monitor_id);
CREATE INDEX IF NOT EXISTS idx_client_communications_client_id ON public.client_communications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_communications_type ON public.client_communications(type);
CREATE INDEX IF NOT EXISTS idx_client_list_subscriptions_client_id ON public.client_list_subscriptions(client_id);

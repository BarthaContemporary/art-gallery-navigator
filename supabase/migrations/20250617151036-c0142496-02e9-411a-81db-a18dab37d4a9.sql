
-- Add Campaign Monitor API configuration table
CREATE TABLE IF NOT EXISTS public.campaign_monitor_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_encrypted text,
  client_id text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on campaign monitor config (admin only)
ALTER TABLE public.campaign_monitor_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for campaign monitor config (admin only)
CREATE POLICY "Admins can manage campaign monitor config"
  ON public.campaign_monitor_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Add sync status columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cm_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS cm_last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cm_sync_error text;

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_clients_cm_sync_status ON public.clients(cm_sync_status);

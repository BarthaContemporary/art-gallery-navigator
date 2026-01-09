-- Create storage bucket for deal attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-attachments', 'deal-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create deal attachments table
CREATE TABLE public.crm_deal_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_deal_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal attachments
CREATE POLICY "Authenticated users can view deal attachments"
ON public.crm_deal_attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert deal attachments"
ON public.crm_deal_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
ON public.crm_deal_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Storage policies for deal-attachments bucket
CREATE POLICY "Authenticated users can view deal attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'deal-attachments');

CREATE POLICY "Authenticated users can upload deal attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deal-attachments');

CREATE POLICY "Users can delete deal attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'deal-attachments');

-- Create index for faster lookups
CREATE INDEX idx_crm_deal_attachments_deal_id ON public.crm_deal_attachments(deal_id);
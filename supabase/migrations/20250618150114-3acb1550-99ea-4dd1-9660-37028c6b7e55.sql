
-- Create client_lists table
CREATE TABLE public.client_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create junction table for client-list relationships
CREATE TABLE public.client_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  list_id uuid REFERENCES public.client_lists(id) ON DELETE CASCADE NOT NULL,
  added_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id, list_id)
);

-- Enable RLS on both tables
ALTER TABLE public.client_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for client_lists (admin only)
CREATE POLICY "Admins can manage client lists"
  ON public.client_lists
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Create RLS policies for client_list_members (admin only)
CREATE POLICY "Admins can manage client list members"
  ON public.client_list_members
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- Create indexes for better performance
CREATE INDEX idx_client_list_members_client_id ON public.client_list_members(client_id);
CREATE INDEX idx_client_list_members_list_id ON public.client_list_members(list_id);

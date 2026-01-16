-- Fix 1: Replace overly permissive RLS policies on CRM tables with admin-only policies
-- These tables contain sensitive business data and should only be accessible to admins

-- crm_contact_organizations
DROP POLICY IF EXISTS "Authenticated users can delete contact organizations" ON public.crm_contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can insert contact organizations" ON public.crm_contact_organizations;
DROP POLICY IF EXISTS "Authenticated users can update contact organizations" ON public.crm_contact_organizations;

CREATE POLICY "Admins can manage contact organizations"
ON public.crm_contact_organizations
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- crm_deal_contacts
DROP POLICY IF EXISTS "Authenticated users can delete deal contacts" ON public.crm_deal_contacts;
DROP POLICY IF EXISTS "Authenticated users can create deal contacts" ON public.crm_deal_contacts;
DROP POLICY IF EXISTS "Authenticated users can update deal contacts" ON public.crm_deal_contacts;

CREATE POLICY "Admins can manage deal contacts"
ON public.crm_deal_contacts
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- crm_deal_interactions
DROP POLICY IF EXISTS "Authenticated users can delete deal interactions" ON public.crm_deal_interactions;
DROP POLICY IF EXISTS "Authenticated users can insert deal interactions" ON public.crm_deal_interactions;
DROP POLICY IF EXISTS "Authenticated users can update deal interactions" ON public.crm_deal_interactions;

CREATE POLICY "Admins can manage deal interactions"
ON public.crm_deal_interactions
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- crm_deal_items
DROP POLICY IF EXISTS "Authenticated users can delete deal items" ON public.crm_deal_items;
DROP POLICY IF EXISTS "Authenticated users can create deal items" ON public.crm_deal_items;
DROP POLICY IF EXISTS "Authenticated users can update deal items" ON public.crm_deal_items;

CREATE POLICY "Admins can manage deal items"
ON public.crm_deal_items
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- publications - admin only for modifications
DROP POLICY IF EXISTS "Authenticated can delete publications" ON public.publications;
DROP POLICY IF EXISTS "Authenticated can update publications" ON public.publications;

CREATE POLICY "Admins can update publications"
ON public.publications
FOR UPDATE
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can delete publications"
ON public.publications
FOR DELETE
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Fix 2: Allow users to view their own security events
CREATE POLICY "Users can view their own security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
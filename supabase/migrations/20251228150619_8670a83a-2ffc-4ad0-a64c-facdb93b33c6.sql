-- Fix crm_contacts table RLS policy
-- Issue: Policy uses {public} role which includes anonymous users

-- Drop the existing policy
DROP POLICY IF EXISTS "crm_contacts_admin_only" ON public.crm_contacts;

-- Recreate with proper authentication requirement
CREATE POLICY "crm_contacts_admin_only"
ON public.crm_contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));
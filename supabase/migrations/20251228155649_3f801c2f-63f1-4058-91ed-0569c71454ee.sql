
-- =====================================================
-- COMPREHENSIVE CRM DATA SECURITY FIX
-- Protects customer contact info, business partner data, and financial information
-- =====================================================

-- =====================================================
-- 1. PROTECT CRM CONTACTS (Customer PII)
-- =====================================================

DROP POLICY IF EXISTS "crm_contacts_admin_only" ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_admin_access" ON public.crm_contacts;

CREATE POLICY "crm_contacts_admin_access" 
ON public.crm_contacts 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_contacts FROM anon;

-- =====================================================
-- 2. PROTECT CRM ORGANIZATIONS (Business Partner Data)
-- =====================================================

DROP POLICY IF EXISTS "crm_organizations_admin_only" ON public.crm_organizations;
DROP POLICY IF EXISTS "crm_organizations_admin_access" ON public.crm_organizations;

CREATE POLICY "crm_organizations_admin_access" 
ON public.crm_organizations 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_organizations FROM anon;

-- =====================================================
-- 3. PROTECT CRM DEALS (Financial Data)
-- =====================================================

DROP POLICY IF EXISTS "crm_deals_admin_only" ON public.crm_deals;
DROP POLICY IF EXISTS "crm_deals_admin_access" ON public.crm_deals;

CREATE POLICY "crm_deals_admin_access" 
ON public.crm_deals 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_deals FROM anon;

-- =====================================================
-- 4. PROTECT CRM DEAL ITEMS (Financial Line Items)
-- =====================================================

DROP POLICY IF EXISTS "crm_deal_items_authenticated_select" ON public.crm_deal_items;
DROP POLICY IF EXISTS "crm_deal_items_authenticated_insert" ON public.crm_deal_items;
DROP POLICY IF EXISTS "crm_deal_items_authenticated_update" ON public.crm_deal_items;
DROP POLICY IF EXISTS "crm_deal_items_authenticated_delete" ON public.crm_deal_items;
DROP POLICY IF EXISTS "crm_deal_items_admin_access" ON public.crm_deal_items;

CREATE POLICY "crm_deal_items_admin_access" 
ON public.crm_deal_items 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_deal_items FROM anon;

-- =====================================================
-- 5. PROTECT CRM INTERACTIONS (Communication History)
-- =====================================================

DROP POLICY IF EXISTS "crm_interactions_admin_only" ON public.crm_interactions;
DROP POLICY IF EXISTS "crm_interactions_admin_access" ON public.crm_interactions;

CREATE POLICY "crm_interactions_admin_access" 
ON public.crm_interactions 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_interactions FROM anon;

-- =====================================================
-- 6. PROTECT CRM LISTS & MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "crm_lists_admin_only" ON public.crm_lists;
DROP POLICY IF EXISTS "crm_list_members_admin_only" ON public.crm_list_members;
DROP POLICY IF EXISTS "crm_lists_admin_access" ON public.crm_lists;
DROP POLICY IF EXISTS "crm_list_members_admin_access" ON public.crm_list_members;

CREATE POLICY "crm_lists_admin_access" 
ON public.crm_lists 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_list_members_admin_access" 
ON public.crm_list_members 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_lists FROM anon;
REVOKE ALL ON public.crm_list_members FROM anon;

-- =====================================================
-- 7. PROTECT ARTWORK PRICING
-- Remove anonymous direct access, use existing safe view
-- =====================================================

-- Remove public anonymous access policy - pricing data should not be public
DROP POLICY IF EXISTS "Public can view artworks" ON public.artworks;

-- Keep admin and artist policies (already exist), add authenticated user read-only if not exists
DROP POLICY IF EXISTS "Authenticated users can view artworks" ON public.artworks;
CREATE POLICY "Authenticated users can view artworks" 
ON public.artworks 
FOR SELECT 
TO authenticated
USING (true);

-- Revoke direct anonymous SELECT on artworks table (they should use artworks_public_safe view)
REVOKE SELECT ON public.artworks FROM anon;

-- Ensure safe view grants are correct
GRANT SELECT ON public.artworks_public_safe TO anon;
GRANT SELECT ON public.artworks_public_safe TO authenticated;

-- =====================================================
-- 8. PROTECT CRM CAMPAIGNS (Marketing Data)
-- =====================================================

DROP POLICY IF EXISTS "crm_campaigns_admin_only" ON public.crm_campaigns;
DROP POLICY IF EXISTS "crm_campaigns_admin_access" ON public.crm_campaigns;

CREATE POLICY "crm_campaigns_admin_access" 
ON public.crm_campaigns 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_campaigns FROM anon;

-- =====================================================
-- 9. PROTECT CRM PIPELINES & STAGES
-- =====================================================

DROP POLICY IF EXISTS "crm_pipelines_admin_only" ON public.crm_pipelines;
DROP POLICY IF EXISTS "crm_pipeline_stages_admin_only" ON public.crm_pipeline_stages;
DROP POLICY IF EXISTS "crm_pipelines_admin_access" ON public.crm_pipelines;
DROP POLICY IF EXISTS "crm_pipeline_stages_admin_access" ON public.crm_pipeline_stages;

CREATE POLICY "crm_pipelines_admin_access" 
ON public.crm_pipelines 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "crm_pipeline_stages_admin_access" 
ON public.crm_pipeline_stages 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_pipelines FROM anon;
REVOKE ALL ON public.crm_pipeline_stages FROM anon;

-- =====================================================
-- 10. PROTECT CRM EXPORT HISTORY (Sensitive Audit Data)
-- =====================================================

DROP POLICY IF EXISTS "crm_export_history_admin_access" ON public.crm_export_history;

ALTER TABLE public.crm_export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_export_history_admin_access" 
ON public.crm_export_history 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

REVOKE ALL ON public.crm_export_history FROM anon;

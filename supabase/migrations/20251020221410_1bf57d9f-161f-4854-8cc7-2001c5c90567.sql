-- ============================================
-- Fix: Complete Artwork Pricing and Cost Basis Exposed Publicly
-- Restrict artworks table to authenticated users only
-- Create public-safe view for collection viewing pages
-- ============================================

-- Step 1: Drop the overly permissive RLS policy allowing public access to all artworks
DROP POLICY IF EXISTS "Anyone can view available artworks" ON public.artworks;

-- Step 2: Keep admin and artist-owner policies intact (they're already secure)
-- No changes needed to existing secure policies

-- Step 3: Create a public-safe view for collection viewing pages
-- This view EXCLUDES all cost basis and financial intelligence data
CREATE OR REPLACE VIEW public.artworks_public_safe 
WITH (security_invoker = true) AS
SELECT 
  a.id,
  a.title,
  a.artist_id,
  a.year,
  a.medium_type,
  a.materials,
  a.classification,
  a.edition_size,
  a.available_works,
  a.artist_proofs,
  a.price,              -- Include public retail price
  a.currency,           -- Include currency for price display
  a.status,
  a.image_url,
  a.dimensions,
  a.width,
  a.height,
  a.depth,
  a.condition,
  a.story,
  a.exhibition_history,
  a.provenance,
  a.location_id,
  a.signature_type,
  a.signature_details,
  a.is_framed,
  a.frame_height,
  a.frame_width,
  a.frame_depth,
  a.weight,
  a.has_crate,
  a.crate_height,
  a.crate_width,
  a.crate_depth,
  a.created_at,
  a.updated_at
  -- EXCLUDED for security (cost basis & financial intelligence):
  -- purchase_price, frame_cost, restoration_cost, insurance_value, inventory_quantity
FROM public.artworks a
WHERE a.status = 'available';

-- Step 4: Grant public access to the safe view
GRANT SELECT ON public.artworks_public_safe TO authenticated;
GRANT SELECT ON public.artworks_public_safe TO anon;

-- Step 5: Add security documentation comment
COMMENT ON VIEW public.artworks_public_safe IS 
'Public-safe view of available artworks for collection viewing pages. Includes public retail pricing (price, currency) but EXCLUDES cost basis data (purchase_price, frame_cost, restoration_cost, insurance_value) to prevent exposure of profit margins, acquisition costs, and financial intelligence to competitors and the public. Only shows artworks with status=available.';

-- Fix the linter warning: set the view to use SECURITY INVOKER explicitly
ALTER VIEW public.tour_share_links_public_safe SET (security_invoker = true);

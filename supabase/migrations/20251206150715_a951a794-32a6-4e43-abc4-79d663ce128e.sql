-- Fix security_invoker for artwork_images_public_safe view
ALTER VIEW public.artwork_images_public_safe SET (security_invoker = true);

-- Fix security_invoker for locations_booking_safe view
ALTER VIEW public.locations_booking_safe SET (security_invoker = true);
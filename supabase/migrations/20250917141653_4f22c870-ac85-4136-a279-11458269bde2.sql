-- Fix security linter warning: Set search_path for the function
CREATE OR REPLACE FUNCTION public.update_notification_campaigns_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
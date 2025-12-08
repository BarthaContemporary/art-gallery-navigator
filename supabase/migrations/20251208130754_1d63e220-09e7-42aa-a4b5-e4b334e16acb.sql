-- Fix: booking_settings notification_email exposure
-- Create a public-safe view that excludes the notification_email

-- Drop existing public view policy if it allows broad access
DROP POLICY IF EXISTS "Authenticated users can view booking settings" ON public.booking_settings;

-- Create a safe view for public access (excludes notification_email)
CREATE OR REPLACE VIEW public.booking_settings_public_safe 
WITH (security_invoker = true)
AS SELECT 
    id,
    advance_booking_days,
    buffer_time_minutes,
    auto_confirm,
    business_hours_start,
    business_hours_end,
    working_days,
    email_reminders,
    reminder_hours,
    admin_notifications,
    confirmation_emails,
    booking_instructions,
    created_at,
    updated_at
    -- notification_email is intentionally excluded
FROM public.booking_settings;

-- Grant access to the safe view
GRANT SELECT ON public.booking_settings_public_safe TO anon;
GRANT SELECT ON public.booking_settings_public_safe TO authenticated;

-- Add a restrictive policy for the raw table - admin only for full access
CREATE POLICY "Only admins can view full booking settings" 
ON public.booking_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Comment explaining the security design
COMMENT ON VIEW public.booking_settings_public_safe IS 
'Public-safe view of booking settings. Excludes notification_email to prevent admin email exposure. 
Use this view for public booking pages. Admin access to notification_email requires direct table access with admin role.';
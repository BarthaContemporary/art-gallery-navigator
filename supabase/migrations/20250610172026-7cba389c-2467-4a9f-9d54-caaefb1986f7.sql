
-- Add email notification columns to booking_settings table
ALTER TABLE public.booking_settings 
ADD COLUMN email_reminders boolean DEFAULT true,
ADD COLUMN reminder_hours integer DEFAULT 24,
ADD COLUMN admin_notifications boolean DEFAULT true,
ADD COLUMN confirmation_emails boolean DEFAULT true;

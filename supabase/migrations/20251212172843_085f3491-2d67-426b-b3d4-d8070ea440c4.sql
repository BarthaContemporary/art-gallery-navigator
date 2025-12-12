-- Add profile_image_url column to crm_contacts for storing downloaded profile images
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS profile_image_url text;
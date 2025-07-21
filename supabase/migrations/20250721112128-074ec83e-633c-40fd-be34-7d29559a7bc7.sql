-- Add AI description field to artworks table
ALTER TABLE public.artworks 
ADD COLUMN ai_description text;
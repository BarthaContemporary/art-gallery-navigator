-- Add additional_keywords field to artworks table
ALTER TABLE public.artworks 
ADD COLUMN additional_keywords TEXT;

-- Create table to store copies of generated descriptions
CREATE TABLE public.ai_description_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  keywords_used TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  model_used TEXT DEFAULT 'gpt-4.1-2025-04-14'
);

-- Enable RLS on ai_description_history table
ALTER TABLE public.ai_description_history ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_description_history
CREATE POLICY "Users can view AI description history for accessible artworks" 
ON public.ai_description_history 
FOR SELECT 
USING (
  artwork_id IN (
    SELECT artworks.id
    FROM artworks
    JOIN artists ON artworks.artist_id = artists.id
    WHERE artists.user_id = auth.uid()
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Users can insert AI description history for their artworks" 
ON public.ai_description_history 
FOR INSERT 
WITH CHECK (
  artwork_id IN (
    SELECT artworks.id
    FROM artworks
    JOIN artists ON artworks.artist_id = artists.id
    WHERE artists.user_id = auth.uid()
    OR is_admin(auth.uid())
  )
);

-- Create index for better performance
CREATE INDEX idx_ai_description_history_artwork_id ON public.ai_description_history(artwork_id);
CREATE INDEX idx_ai_description_history_generated_at ON public.ai_description_history(generated_at DESC);
-- Add column to store AI-stitched panorama URL
ALTER TABLE public.tour_nodes
ADD COLUMN IF NOT EXISTS stitched_panorama_url text,
ADD COLUMN IF NOT EXISTS stitch_status text DEFAULT null;

-- stitch_status: null (not started), 'processing', 'completed', 'failed'

COMMENT ON COLUMN public.tour_nodes.stitched_panorama_url IS 'URL of AI-stitched equirectangular panorama image';
COMMENT ON COLUMN public.tour_nodes.stitch_status IS 'Status of AI panorama stitching: null, processing, completed, failed';
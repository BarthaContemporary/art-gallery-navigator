
-- Drop the trigger first, then the function, then recreate both
DROP TRIGGER IF EXISTS ensure_single_primary_video_trigger ON public.artwork_videos;

DROP FUNCTION IF EXISTS public.ensure_single_primary_video();

CREATE OR REPLACE FUNCTION public.ensure_single_primary_video()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        UPDATE public.artwork_videos
        SET is_primary = false
        WHERE artwork_id = NEW.artwork_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';

CREATE TRIGGER ensure_single_primary_video_trigger
    BEFORE INSERT OR UPDATE ON public.artwork_videos
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_single_primary_video();

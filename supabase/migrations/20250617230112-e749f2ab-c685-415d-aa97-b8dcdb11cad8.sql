
-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);

-- Create storage policy for chat images bucket
CREATE POLICY "Anyone can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Anyone can view chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own chat images"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update the cleanup function to delete messages older than 1 week instead of 2 weeks
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages_weekly()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete messages that were first read more than 1 week ago
  DELETE FROM public.chat_messages
  WHERE first_read_at IS NOT NULL 
  AND first_read_at < NOW() - INTERVAL '7 days';
  
  -- Also delete unread messages older than 1 week
  DELETE FROM public.chat_messages
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$function$;

-- Update artwork-images bucket to allow 300MB file uploads
UPDATE storage.buckets 
SET file_size_limit = 314572800  -- 300MB in bytes
WHERE id = 'artwork-images';
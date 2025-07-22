-- Make the artwork-images-original bucket public for Google Docs export
UPDATE storage.buckets SET public = true WHERE id = 'artwork-images-original';
-- Insert the 9 viewer artworks into the main artworks table
-- Using Mike Meiré's artist_id: 57739d6a-9f26-445b-bb29-43775edbf029

INSERT INTO artworks (id, title, artist_id, year, medium_type, classification, currency, status, image_url)
SELECT 
  gen_random_uuid() as id,
  va.title,
  '57739d6a-9f26-445b-bb29-43775edbf029'::uuid as artist_id,
  va.year::integer as year,
  'Painting' as medium_type,
  'Unique' as classification,
  'EUR' as currency,
  'Available' as status,
  (SELECT vai.original_url FROM viewer_artwork_images vai WHERE vai.artwork_id = va.id AND vai.position = 0 LIMIT 1) as image_url
FROM viewer_artworks va
WHERE NOT EXISTS (
  SELECT 1 FROM artworks a 
  WHERE a.title = va.title 
  AND a.artist_id = '57739d6a-9f26-445b-bb29-43775edbf029'::uuid
);

-- Insert all artwork images for the newly added artworks
INSERT INTO artwork_images (artwork_id, image_url, is_primary, display_order, processed, processing_status)
SELECT 
  a.id as artwork_id,
  vai.original_url as image_url,
  (vai.position = 0) as is_primary,
  vai.position as display_order,
  false as processed,
  'pending' as processing_status
FROM viewer_artworks va
JOIN viewer_artwork_images vai ON vai.artwork_id = va.id
JOIN artworks a ON a.title = va.title AND a.artist_id = '57739d6a-9f26-445b-bb29-43775edbf029'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM artwork_images ai 
  WHERE ai.artwork_id = a.id 
  AND ai.image_url = vai.original_url
);
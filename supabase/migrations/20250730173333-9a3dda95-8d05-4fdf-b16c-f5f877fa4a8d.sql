-- Link Jill Baroff artist record to the user account
UPDATE public.artists 
SET user_id = 'b349e5cd-fdc9-4228-bd9e-e2748db9e3ab'
WHERE id = 'cf0198bf-06a3-4b0b-8843-6ff8ee0a421c' 
AND email = 'info@barthacontemporary.com';
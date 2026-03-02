-- Reset the stuck processing node so the user can retry
UPDATE public.tour_nodes SET stitch_status = NULL WHERE id = 'ad27b537-1495-428f-a491-e425c4717a83' AND stitch_status = 'processing';
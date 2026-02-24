-- Add a column to store LiDAR room scan data (wall polygons, dimensions) on tour projects
ALTER TABLE public.tour_projects
ADD COLUMN IF NOT EXISTS room_scan_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.tour_projects.room_scan_data IS 'JSON data from RoomPlan LiDAR scan: walls, doors, windows as 2D polygon outlines';
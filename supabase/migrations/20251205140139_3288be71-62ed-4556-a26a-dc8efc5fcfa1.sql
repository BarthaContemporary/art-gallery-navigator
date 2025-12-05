-- Insert default sections for all existing projects that don't have sections yet
INSERT INTO public.project_sections (project_id, name, color, position)
SELECT p.id, s.name, s.color, s.position
FROM projects p
CROSS JOIN (
  VALUES 
    ('Backlog', '#6B7280', 0),
    ('To Do', '#3B82F6', 1),
    ('In Progress', '#F59E0B', 2),
    ('Done', '#10B981', 3)
) AS s(name, color, position)
WHERE NOT EXISTS (
  SELECT 1 FROM project_sections ps WHERE ps.project_id = p.id
);
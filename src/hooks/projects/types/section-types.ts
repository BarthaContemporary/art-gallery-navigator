/**
 * Section-related type definitions for Kanban board
 */

export interface ProjectSection {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionInput {
  project_id: string;
  name: string;
  color?: string;
  position?: number;
}

export interface UpdateSectionInput {
  id: string;
  data: Partial<Omit<CreateSectionInput, 'project_id'>>;
}

export interface ReorderSectionsInput {
  project_id: string;
  sections: Array<{ id: string; position: number }>;
}

// Extended task type with section info and new fields
export interface KanbanTask {
  id: string;
  project_id: string;
  section_id: string | null;
  name: string;
  description: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  priority: string; // Allow string from DB
  position: number;
  start_date: string;
  end_date: string;
  done_date: string | null;
  estimated_hours: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  assignee: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface MoveTaskInput {
  taskId: string;
  sourceSectionId: string | null;
  targetSectionId: string | null;
  newPosition: number;
}

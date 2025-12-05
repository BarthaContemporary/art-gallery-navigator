/**
 * Task-related type definitions
 */

// Priority type
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// Task with assignee
export interface TaskWithAssignee {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  start_date: string;
  end_date: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // New fields (optional for backward compatibility)
  section_id?: string | null;
  priority?: string | null; // Allow string from DB
  position?: number | null;
  estimated_hours?: number | null;
  done_date?: string | null;
  assignee: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  references?: Array<{
    id: string;
    type: 'document' | 'collection' | 'artwork' | 'artist';
  }>;
}

// Create task input
export interface CreateTaskInput {
  project_id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  start_date: string;
  end_date: string;
  assigned_to?: string | null;
  // New fields
  section_id?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  position?: number;
  estimated_hours?: number | null;
  references?: Array<{
    id: string;
    type: 'document' | 'collection' | 'artwork' | 'artist';
  }>;
}

// Update task input
export interface UpdateTaskInput {
  id: string;
  data: Partial<CreateTaskInput>;
}


// Re-export types from the dedicated types file
export * from "./project-types";

// Define task-related types
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
  assignee: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CreateTaskInput {
  project_id: string;
  name: string;
  description?: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  start_date: string;
  end_date: string;
  assigned_to?: string | null;
  references?: Array<{
    id: string;
    type: string;
  }>;
}

export interface UpdateTaskInput {
  id: string;
  data: Partial<CreateTaskInput>;
}

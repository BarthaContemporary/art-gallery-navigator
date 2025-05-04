
export interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  assigned_to: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface TaskWithAssignee extends ProjectTask {
  assignee: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export interface CreateTaskInput {
  project_id: string;
  name: string;
  description?: string;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  assigned_to?: string;
  start_date: string;
  end_date: string;
  references?: {
    type: 'document' | 'collection' | 'artwork' | 'artist';
    id: string;
  }[];
}

export interface UpdateTaskInput {
  id: string;
  data: Partial<CreateTaskInput>;
}

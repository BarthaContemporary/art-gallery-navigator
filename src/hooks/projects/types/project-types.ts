
// Base Project type
export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  type: 'exhibition' | 'fair' | 'publication' | 'talk' | 'other';
  location_id: string | null;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Project with location details
export interface ProjectWithLocation extends Project {
  location: { name: string } | null;
  // If members were to be included here, they should use the canonical ProjectMember type
  // e.g., members?: ProjectMember[]; 
}

// Input for creating a project
// Changed member_ids to user_emails to align with mutation logic
export interface CreateProjectInput extends Omit<Project, 'id' | 'created_at' | 'updated_at' | 'location'> {
  user_emails?: string[]; // For initial members, using emails as per mutation hooks
}

// Input for updating a project
export interface UpdateProjectInput {
  id: string;
  // data will be Partial<CreateProjectInput>, so user_emails will be allowed if present in CreateProjectInput
  data: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'location'> & { user_emails?: string[] }>;
}

// Note: ProjectMember interface has been removed from this file.
// The canonical ProjectMember type is defined in member-types.ts and exported via @/hooks/projects.


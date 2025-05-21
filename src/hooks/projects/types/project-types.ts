
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
export interface CreateProjectInput extends Omit<Project, 'id' | 'created_at' | 'updated_at' | 'location'> {
  member_ids?: string[]; // For initial members
}

// Input for updating a project
export interface UpdateProjectInput {
  id: string;
  data: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at' | 'location'>>;
}

// Note: ProjectMember interface has been removed from this file.
// The canonical ProjectMember type is defined in member-types.ts and exported via @/hooks/projects.


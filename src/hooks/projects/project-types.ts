
// Define basic project types without any circular references

// Base project type
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  type: 'exhibition' | 'fair' | 'publication' | 'talk' | 'other';
  location_id: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

// Simple location type for embedding
export interface SimpleLocation {
  name: string;
}

// Extended type with location as a simple nested object
export interface ProjectWithLocation extends Project {
  location: SimpleLocation | null;
}

// Simple, flat type for project members
export interface ProjectMember {
  user_id: string;
  project_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

// Input type for creating projects
export interface CreateProjectInput {
  name: string;
  description?: string;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  type: 'exhibition' | 'fair' | 'publication' | 'talk' | 'other';
  location_id?: string;
  start_date: string;
  end_date: string;
  user_emails?: string[];
}

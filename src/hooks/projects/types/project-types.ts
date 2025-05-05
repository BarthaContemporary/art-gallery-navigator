
/**
 * Core type definitions for projects
 */

// Basic project type
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

// Simple location type
export interface SimpleLocation {
  name: string;
}

// Project with location
export interface ProjectWithLocation extends Project {
  location: SimpleLocation | null;
}

// Project member
export interface ProjectMember {
  user_id: string;
  project_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

// Create project input
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

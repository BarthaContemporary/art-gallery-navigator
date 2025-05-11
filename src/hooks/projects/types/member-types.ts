
/**
 * Project member types and utilities
 */

// Basic member type representing a user who is part of a project
export interface ProjectMember {
  user_id: string;
  project_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
}

// Input for adding a new member to a project
export interface AddProjectMemberInput {
  project_id: string;
  email: string;
}

// Response from member operations
export interface MemberOperationResult {
  success: boolean;
  message: string;
  member?: ProjectMember;
}

// Type for profile data returned from Supabase
export interface ProfileData {
  id?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email_confirmed?: boolean | null;
}

// Interface for Supabase SelectQueryError to help with type checking
interface SelectQueryError {
  code?: string;
  message?: string;
  details?: string;
}

// Enhanced type guard to check if an object is a valid ProfileData
export function isProfileData(obj: any): obj is ProfileData {
  // Check if obj is a valid object and not null
  if (!obj || typeof obj !== 'object') return false;
  
  // Check if it's a SelectQueryError from Supabase
  if ('code' in obj && 'message' in obj && 'details' in obj) {
    // This matches the pattern of a SelectQueryError, so it's not valid profile data
    return false;
  }
  
  // Check if it has any properties that might suggest it's a SelectQueryError
  if ('error' in obj || obj.code === 'PGRST116') return false;
  
  // Return true if it's a valid object (even with no matching properties)
  // This is safe because we'll provide sensible defaults when using the result
  return true;
}

// Helper to create a consistent member object from user data
export function createMemberFromUser(
  userId: string,
  projectId: string,
  displayName: string | null,
  email: string | null,
  avatarUrl: string | null
): ProjectMember {
  return {
    user_id: userId,
    project_id: projectId,
    display_name: displayName || email || 'Unknown User',
    avatar_url: avatarUrl,
    email: email
  };
}


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

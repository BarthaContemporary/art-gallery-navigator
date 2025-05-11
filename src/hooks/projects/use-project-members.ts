import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ProjectMember } from "./types/member-types";

/**
 * Custom hook for managing project members
 * Provides a centralized way to fetch, add, and remove project members
 */
export function useProjectMembers(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch project members
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // Get project users with profiles in a single query using a join
        const { data, error } = await supabase
          .from('project_users')
          .select(`
            user_id, 
            project_id,
            profiles:user_id (
              display_name,
              avatar_url
            )
          `)
          .eq('project_id', projectId);
          
        if (error) throw error;
        
        // Transform the data to our ProjectMember type
        const members: ProjectMember[] = data.map(item => {
          // Type-safe check for profile data
          const profileData = item.profiles || {};
          const displayName = typeof profileData === 'object' && 'display_name' in profileData ? 
            profileData.display_name as string | null : null;
          const avatarUrl = typeof profileData === 'object' && 'avatar_url' in profileData ? 
            profileData.avatar_url as string | null : null;
            
          return {
            user_id: item.user_id,
            project_id: item.project_id,
            display_name: displayName || 'Unknown User',
            avatar_url: avatarUrl || null,
            email: displayName || null // Using display_name as email since that's what's stored
          };
        });
        
        // If there are no members but current user has access, include them
        if (members.length === 0 && user) {
          members.push({
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          });
        }
        
        return members;
      } catch (error) {
        console.error("Error fetching project members:", error);
        
        // Return current user as fallback
        if (user) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email
          }];
        }
        
        throw error;
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      if (!projectId || !email) {
        throw new Error("Project ID and email are required");
      }
      
      // Find user profile by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('display_name', email) // Using display_name as email
        .single();
      
      if (profileError) {
        throw new Error(profileError.message);
      }
      
      if (!profile?.id) {
        throw new Error(`No user found with email ${email}`);
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profile.id)
        .maybeSingle();
        
      if (existingMember) {
        throw new Error(`${email} is already a member of this project`);
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: profile.id
        });
        
      if (addError) throw addError;
      
      // Return the new member
      return {
        user_id: profile.id,
        project_id: projectId,
        display_name: profile.display_name || email,
        avatar_url: profile.avatar_url || null,
        email: email
      };
    },
    onSuccess: (newMember) => {
      // Update the cache with the new member
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => [...oldData, newMember]
      );
      
      toast.success(`Added ${newMember.email} to the project`);
    },
    onError: (error: Error) => {
      console.error("Error adding member:", error);
      
      // Show user-friendly error message
      if (error.message.includes("No user found")) {
        toast.warning(error.message);
      } else if (error.message.includes("already a member")) {
        toast.info(error.message);
      } else {
        toast.error("Failed to add team member");
      }
    }
  });
  
  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
        
      if (error) throw error;
      
      return userId;
    },
    onSuccess: (userId) => {
      // Update the cache by removing the member
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => oldData.filter(m => m.user_id !== userId)
      );
      
      toast.success("Team member removed");
    },
    onError: (error) => {
      console.error("Error removing member:", error);
      toast.error("Failed to remove team member");
    }
  });
  
  const addMember = (email: string) => {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    
    addMemberMutation.mutate({ email: email.trim() });
  };
  
  const removeMember = (userId: string) => {
    // Don't allow removing yourself
    if (userId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    // Don't allow removing the last member
    if (membersQuery.data && membersQuery.data.length <= 1) {
      toast.warning("Projects must have at least one member");
      return;
    }
    
    removeMemberMutation.mutate(userId);
  };
  
  return {
    members: membersQuery.data || [],
    isLoading: membersQuery.isLoading || addMemberMutation.isPending || removeMemberMutation.isPending,
    isError: membersQuery.isError,
    error: membersQuery.error,
    refetch: membersQuery.refetch,
    addMember,
    removeMember,
    isAddingMember: addMemberMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending
  };
}

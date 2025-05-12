
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
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch project members
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      if (!projectId) return [];
      
      try {
        // Get project users
        const { data: projectUsers, error: projectUsersError } = await supabase
          .from('project_users')
          .select('user_id, project_id')
          .eq('project_id', projectId);
          
        if (projectUsersError) throw projectUsersError;
        
        // Get all user IDs from project_users
        const memberIds = new Set(projectUsers?.map(pu => pu.user_id) || []);
        
        // If current user is admin, add them regardless
        if (user && isAdmin) {
          memberIds.add(user.id);
        }
        
        // If no members found and it's not a new project, return empty array
        if (memberIds.size === 0) {
          // For new projects, include the current user automatically
          if (user) {
            memberIds.add(user.id);
          }
          
          if (memberIds.size === 0) {
            return [];
          }
        }
        
        // Convert set to array
        const userIds = Array.from(memberIds);
        
        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        if (profilesError) throw profilesError;
        
        // Get admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin')
          .in('user_id', userIds);
          
        if (adminError) throw adminError;
        
        // Create a set of admin user IDs for quick lookup
        const adminUserIds = new Set(adminUsers?.map(u => u.user_id) || []);
        
        // Map profiles to members format
        const members: ProjectMember[] = userIds.map(userId => {
          const profile = profiles?.find(p => p.id === userId);
          const isUserAdmin = adminUserIds.has(userId);
          
          return {
            user_id: userId,
            project_id: projectId,
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url || null,
            email: profile?.display_name || null,
            is_admin: isUserAdmin
          };
        });
        
        return members;
      } catch (error) {
        console.error("Error fetching project members:", error);
        
        // Return current user as fallback if they're an admin
        if (user && isAdmin) {
          return [{
            user_id: user.id,
            project_id: projectId,
            display_name: user.email || 'Current User',
            avatar_url: null,
            email: user.email,
            is_admin: true
          }];
        }
        
        throw error;
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  // Add member by ID mutation
  const addMemberByIdMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId || !userId) {
        throw new Error("Project ID and user ID are required");
      }
      
      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (checkError) throw checkError;
      
      if (existingMember) {
        throw new Error("User is already a member of this project");
      }
      
      // Add the member
      const { error: addError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: userId
        });
        
      if (addError) throw addError;
      
      // Get the user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single();
        
      if (profileError) throw profileError;
      
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gallery_admin')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Return the member data
      return {
        user_id: userId,
        project_id: projectId,
        display_name: profile.display_name || 'Unknown User',
        avatar_url: profile.avatar_url || null,
        email: profile.display_name,
        is_admin: !!adminRole
      };
    },
    onSuccess: (newMember) => {
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => [...oldData, newMember]
      );
    },
    onError: (error: Error) => {
      console.error("Error adding member:", error);
      toast.error(error.message || "Failed to add team member");
    }
  });
  
  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      
      // Admin users cannot be removed as they have automatic access
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gallery_admin')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (adminRole) {
        throw new Error("Admin users cannot be removed from projects");
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
      // Update the cache by filtering out the removed member
      queryClient.setQueryData(
        ['project-members', projectId],
        (oldData: ProjectMember[] = []) => oldData.filter(m => m.user_id !== userId)
      );
      
      toast.success("Team member removed");
    },
    onError: (error: Error) => {
      console.error("Error removing member:", error);
      toast.error(error.message || "Failed to remove team member");
    }
  });
  
  const addMemberById = async (userId: string) => {
    await addMemberByIdMutation.mutateAsync(userId);
  };
  
  const removeMember = (userId: string) => {
    // Don't allow removing yourself
    if (userId === user?.id) {
      toast.warning("You cannot remove yourself from the project");
      return;
    }
    
    // Don't allow removing admin users
    const memberToRemove = membersQuery.data?.find(m => m.user_id === userId);
    if (memberToRemove?.is_admin) {
      toast.info("Admin users automatically have access to all projects");
      return;
    }
    
    // Don't allow removing the last non-admin member
    const nonAdminMembers = membersQuery.data?.filter(m => !m.is_admin) || [];
    if (nonAdminMembers.length <= 1 && nonAdminMembers.some(m => m.user_id === userId)) {
      toast.warning("Projects must have at least one member");
      return;
    }
    
    removeMemberMutation.mutate(userId);
  };
  
  return {
    members: membersQuery.data || [],
    isLoading: membersQuery.isLoading || addMemberByIdMutation.isPending || removeMemberMutation.isPending,
    isError: membersQuery.isError,
    error: membersQuery.error,
    refetch: membersQuery.refetch,
    addMemberById,
    removeMember,
    isAddingMember: addMemberByIdMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending
  };
}

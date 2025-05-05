
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// Base project type without any nested objects
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

// Extended type with location - using a simple nested object that won't cause recursion
export interface ProjectWithLocation extends Project {
  location: {
    name: string;
  } | null;
}

// Simple flat type for project users, no nested profiles
export interface ProjectUser {
  user_id: string;
  project_id: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

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

// Re-export from separate files to avoid circular dependencies
export { useProjectMembers } from "./projects/use-project-members";
export type { ProjectMember } from "./projects/use-project-members";

export function useProjects(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  const { user, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          location:locations(name)
        `);
      
      if (filters?.status && filters.status !== "all") {
        query = query.eq('status', filters.status as 'active' | 'scheduled' | 'completed' | 'abandoned');
      }
      
      if (filters?.type && filters.type !== "all") {
        query = query.eq('type', filters.type as 'exhibition' | 'fair' | 'publication' | 'talk' | 'other');
      }
      
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      
      const { data, error } = await query.order('start_date', { ascending: true });
      
      if (error) throw error;
      return data as ProjectWithLocation[];
    },
    enabled: !!user
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          location:locations(name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ProjectWithLocation;
    },
    enabled: !!id
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { user_emails, ...projectData } = input;
      
      // First create the project
      const { data: project, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Then add users if provided (by email)
      if (user_emails && user_emails.length > 0) {
        try {
          // Find users by email
          const { data: foundUsers, error: userError } = await supabase
            .from('profiles')
            .select('id')
            .in('email', user_emails);
          
          if (userError) throw userError;
          
          // Add found users to the project
          if (foundUsers && foundUsers.length > 0) {
            const projectUsers = foundUsers.map(user => ({
              project_id: project.id,
              user_id: user.id
            }));
            
            const { error: usersError } = await supabase
              .from('project_users')
              .insert(projectUsers);
            
            if (usersError) throw usersError;
          }
          
          // For unmatched emails, we could implement an invitation system later
          if (foundUsers) {
            const unmatchedEmails = user_emails.filter(email => 
              !foundUsers.some(user => user.id && email)
            );
            
            if (unmatchedEmails.length > 0) {
              console.log("Some emails were not matched to users:", unmatchedEmails);
            }
          }
        } catch (userError) {
          console.error("Error adding users by email:", userError);
        }
      }
      
      return project;
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<CreateProjectInput> }) => {
      const { user_emails, ...projectData } = data;
      
      // Update the project
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update users if provided (by email)
      if (user_emails !== undefined) {
        try {
          // First delete all existing project users
          const { error: deleteError } = await supabase
            .from('project_users')
            .delete()
            .eq('project_id', id);
          
          if (deleteError) throw deleteError;
          
          // Then add users by email
          if (user_emails.length > 0) {
            // Find users by email
            const { data: foundUsers, error: userError } = await supabase
              .from('profiles')
              .select('id')
              .in('email', user_emails);
            
            if (userError) throw userError;
            
            // Add found users to the project
            if (foundUsers && foundUsers.length > 0) {
              const projectUsers = foundUsers.map(user => ({
                project_id: id,
                user_id: user.id
              }));
              
              const { error: usersError } = await supabase
                .from('project_users')
                .insert(projectUsers);
              
              if (usersError) throw usersError;
            }
            
            // For emails that don't match any user, we could implement invitations later
            if (foundUsers) {
              const unmatchedEmails = user_emails.filter(email => 
                !foundUsers.some(user => user.id && email)
              );
              
              if (unmatchedEmails.length > 0) {
                console.log("Some emails were not matched to users:", unmatchedEmails);
              }
            }
          }
        } catch (userError) {
          console.error("Error updating users by email:", userError);
        }
      }
      
      return { id };
    },
    onSuccess: (_, variables) => {
      toast.success("Project updated successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, itemDetails }: { id: string, itemDetails: any }) => {
      if (isAdmin) {
        // Admin can delete directly
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
      } else {
        // Non-admin creates a deletion request
        const { error } = await supabase
          .from('deletion_requests')
          .insert({
            item_id: id,
            item_type: 'projects',
            item_details: itemDetails,
            user_id: (await supabase.auth.getUser()).data.user?.id
          });
        
        if (error) throw error;
      }
      
      return { id };
    },
    onSuccess: (_, variables) => {
      if (isAdmin) {
        toast.success("Project deleted successfully");
      } else {
        toast.success("Deletion request submitted for review");
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  });
}

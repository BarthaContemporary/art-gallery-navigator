
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TaskWithAssignee } from "./types";

export function useProjectTasks(projectId: string | undefined, filters?: {
  status?: string;
  assignedTo?: string;
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['project-tasks', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      
      try {
        let query = supabase
          .from('project_tasks')
          .select(`
            *
          `)
          .eq('project_id', projectId);
        
        if (filters?.status && filters.status !== "") {
          query = query.eq('status', filters.status as 'active' | 'scheduled' | 'completed' | 'abandoned');
        }
        
        if (filters?.assignedTo) {
          query = query.eq('assigned_to', filters.assignedTo);
        }
        
        const { data, error } = await query.order('start_date', { ascending: true });
        
        if (error) throw error;
        
        // Get assignee info for each task in a separate query
        const tasksWithAssignees = await Promise.all(data.map(async (task) => {
          let assignee = null;
          
          if (task.assigned_to) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', task.assigned_to)
              .single();
              
            if (!profileError && profileData) {
              assignee = {
                display_name: profileData.display_name || 'Unknown',
                avatar_url: profileData.avatar_url || null
              };
            }
          }
          
          return {
            ...task,
            assignee
          } as TaskWithAssignee;
        }));
        
        return tasksWithAssignees;
      } catch (error) {
        console.error("Error fetching project tasks:", error);
        return [];
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

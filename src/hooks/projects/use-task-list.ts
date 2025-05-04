
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
      
      let query = supabase
        .from('project_tasks')
        .select(`
          *,
          assignee:profiles!inner(display_name, avatar_url)
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
      
      // Transform the data to ensure it matches TaskWithAssignee type
      const tasksWithAssignees = data.map(task => {
        // Handle the case where assignee might be null or have a different structure
        let assignee = null;
        
        if (task.assignee && 
            typeof task.assignee === 'object' && 
            !Array.isArray(task.assignee) && 
            task.assignee !== null) {
          // Type assertion to work with the data
          const assigneeData = task.assignee as unknown as { display_name?: string; avatar_url?: string | null };
          if (assigneeData && typeof assigneeData === 'object') {
            assignee = {
              display_name: assigneeData.display_name || 'Unknown',
              avatar_url: assigneeData.avatar_url || null
            };
          }
        }
          
        return {
          ...task,
          assignee
        } as TaskWithAssignee;
      });
      
      return tasksWithAssignees;
    },
    enabled: !!projectId && !!user
  });
}

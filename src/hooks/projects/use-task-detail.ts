
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskWithAssignee } from "./types";

export function useProjectTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['project-task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          assignee:profiles!inner(display_name, avatar_url)
        `)
        .eq('id', taskId)
        .single();
      
      if (error) throw error;
      
      // Handle the case where assignee might be null or have a different structure
      let assignee = null;
      
      if (data.assignee && 
          typeof data.assignee === 'object' && 
          !Array.isArray(data.assignee) && 
          data.assignee !== null) {
        // Type assertion to work with the data
        const assigneeData = data.assignee as unknown as { display_name?: string; avatar_url?: string | null };
        if (assigneeData && typeof assigneeData === 'object') {
          assignee = {
            display_name: assigneeData.display_name || 'Unknown',
            avatar_url: assigneeData.avatar_url || null
          };
        }
      }
          
      return {
        ...data,
        assignee
      } as TaskWithAssignee;
    },
    enabled: !!taskId
  });
}

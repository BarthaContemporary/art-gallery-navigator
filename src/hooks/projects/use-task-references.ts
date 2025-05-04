
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook to get task references
export function useTaskReferences(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-references', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('project_task_references')
        .select(`
          *
        `)
        .eq('task_id', taskId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });
}

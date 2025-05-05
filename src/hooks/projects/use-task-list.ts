
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
          .select('*')
          .eq('project_id', projectId);
        
        if (filters?.status && filters.status !== "") {
          query = query.eq('status', filters.status as 'active' | 'scheduled' | 'completed' | 'abandoned');
        }
        
        if (filters?.assignedTo) {
          query = query.eq('assigned_to', filters.assignedTo);
        }
        
        const { data, error } = await query.order('start_date', { ascending: true });
        
        if (error) {
          console.error("Error fetching project tasks:", error);
          return [];
        }
        
        if (!data || data.length === 0) return [];
        
        // Get assignee info for each task efficiently by grouping the calls
        const assigneeIds = data
          .map(task => task.assigned_to)
          .filter((id): id is string => id !== null && id !== undefined);
          
        // If there are no assignees, return the tasks without assignee info
        if (assigneeIds.length === 0) {
          return data.map(task => ({
            ...task,
            assignee: null
          }));
        }
        
        // Get unique assignee IDs
        const uniqueAssigneeIds = [...new Set(assigneeIds)];
        
        // Fetch all assignee profiles in a single query
        const { data: assigneeProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', uniqueAssigneeIds);
          
        if (profilesError) {
          console.error("Error fetching assignee profiles:", profilesError);
          // Return tasks without assignee info
          return data.map(task => ({
            ...task,
            assignee: null
          }));
        }
        
        // Create a map of assignee profiles for easy lookup
        const assigneeProfileMap = new Map();
        assigneeProfiles?.forEach(profile => {
          assigneeProfileMap.set(profile.id, {
            display_name: profile.display_name || 'Unknown',
            avatar_url: profile.avatar_url || null
          });
        });
        
        // Map the assignee info to each task
        return data.map(task => {
          let assignee = null;
          
          if (task.assigned_to && assigneeProfileMap.has(task.assigned_to)) {
            assignee = assigneeProfileMap.get(task.assigned_to);
          }
          
          return {
            ...task,
            assignee
          };
        });
      } catch (error) {
        console.error("Error fetching project tasks:", error);
        return [];
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

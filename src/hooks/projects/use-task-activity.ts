import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_activity_log')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Fetch user profiles separately
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(activity => ({
        ...activity,
        user: profileMap.get(activity.user_id),
      })) as TaskActivity[];
    },
    enabled: !!taskId,
  });
}

export async function logTaskActivity(
  taskId: string,
  action: string,
  fieldName?: string,
  oldValue?: string,
  newValue?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await supabase.from('task_activity_log').insert({
    task_id: taskId,
    user_id: user.id,
    action,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
  });
}

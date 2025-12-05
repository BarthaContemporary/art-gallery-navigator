import { useTaskActivity } from "@/hooks/projects/use-task-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Activity, Loader2 } from "lucide-react";

interface TaskActivityLogProps {
  taskId: string;
}

export function TaskActivityLog({ taskId }: TaskActivityLogProps) {
  const { data: activities, isLoading } = useTaskActivity(taskId);
  
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const formatActivity = (activity: typeof activities extends (infer T)[] ? T : never) => {
    const userName = activity.user?.display_name || 'Someone';
    
    switch (activity.action) {
      case 'created':
        return `${userName} created this task`;
      case 'updated':
        if (activity.field_name) {
          return `${userName} changed ${activity.field_name} from "${activity.old_value || 'empty'}" to "${activity.new_value}"`;
        }
        return `${userName} updated this task`;
      case 'status_changed':
        return `${userName} changed status from "${activity.old_value}" to "${activity.new_value}"`;
      case 'assigned':
        return `${userName} assigned this task to ${activity.new_value}`;
      case 'unassigned':
        return `${userName} removed assignee ${activity.old_value}`;
      case 'commented':
        return `${userName} added a comment`;
      case 'attachment_added':
        return `${userName} added an attachment`;
      case 'attachment_removed':
        return `${userName} removed an attachment`;
      case 'subtask_added':
        return `${userName} added a subtask`;
      case 'subtask_completed':
        return `${userName} completed a subtask`;
      default:
        return `${userName} ${activity.action}`;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Activity
      </h4>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity yet
          </p>
        )}
        {activities?.map((activity) => (
          <div key={activity.id} className="flex gap-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={activity.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(activity.user?.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                {formatActivity(activity)}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

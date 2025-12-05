import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KanbanTask } from "@/hooks/projects/types/section-types";
import { format } from "date-fns";
import { Calendar, Clock, Flag, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  task: KanbanTask;
  onClick?: (task: KanbanTask) => void;
}

const priorityConfig = {
  low: { color: 'bg-muted text-muted-foreground', icon: 'text-muted-foreground' },
  medium: { color: 'bg-blue-100 text-blue-800', icon: 'text-blue-600' },
  high: { color: 'bg-orange-100 text-orange-800', icon: 'text-orange-600' },
  critical: { color: 'bg-red-100 text-red-800', icon: 'text-red-600' },
};

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    data: {
      type: 'task',
      task,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyles = priorityConfig[task.priority] || priorityConfig.medium;
  const isOverdue = task.end_date && new Date(task.end_date) < new Date() && task.status !== 'completed';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-pointer transition-all border border-border hover:border-primary/50 bg-card group",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing mt-0.5 text-muted-foreground hover:text-foreground transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Task name */}
          <h4 className="font-medium text-sm leading-tight mb-2 line-clamp-2">
            {task.name}
          </h4>
          
          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {task.description}
            </p>
          )}
          
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Priority */}
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", priorityStyles.color)}>
              <Flag className={cn("h-2.5 w-2.5 mr-1", priorityStyles.icon)} />
              {task.priority}
            </Badge>
            
            {/* Due date */}
            {task.end_date && (
              <span className={cn(
                "flex items-center gap-1 text-muted-foreground",
                isOverdue && "text-destructive"
              )}>
                <Calendar className="h-3 w-3" />
                {format(new Date(task.end_date), 'MMM d')}
              </span>
            )}
            
            {/* Estimated hours */}
            {task.estimated_hours && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {task.estimated_hours}h
              </span>
            )}
          </div>
        </div>
        
        {/* Assignee */}
        {task.assignee && (
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={task.assignee.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {task.assignee.display_name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
}

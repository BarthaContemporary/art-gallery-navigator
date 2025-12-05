import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./KanbanCard";
import { ProjectSection, KanbanTask } from "@/hooks/projects/types/section-types";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface KanbanColumnProps {
  section: ProjectSection;
  tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
  onAddTask?: (sectionId: string) => void;
  onEditSection?: (section: ProjectSection) => void;
  onDeleteSection?: (sectionId: string) => void;
}

export function KanbanColumn({
  section,
  tasks,
  onTaskClick,
  onAddTask,
  onEditSection,
  onDeleteSection,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: section.id,
    data: {
      type: 'section',
      section,
    }
  });

  const taskIds = tasks.map(task => task.id);

  return (
    <div className="flex flex-col w-72 min-w-[288px] flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3" 
            style={{ backgroundColor: section.color }}
          />
          <h3 className="font-medium text-sm">{section.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">
            {tasks.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddTask?.(section.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditSection?.(section)}>
                Edit section
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDeleteSection?.(section.id)}
                className="text-destructive"
              >
                Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 bg-muted/30 border border-dashed border-transparent transition-colors min-h-[200px]",
          isOver && "border-primary/50 bg-primary/5"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <KanbanCard 
                key={task.id} 
                task={task} 
                onClick={onTaskClick}
              />
            ))}
          </div>
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

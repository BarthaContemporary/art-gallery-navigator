
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskWithAssignee } from "@/hooks/projects";
import { TaskForm } from "./task-dialog/TaskForm";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: TaskWithAssignee;
}

export function ProjectTaskDialog({ open, onOpenChange, projectId, task }: ProjectTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]"> {/* Added flex flex-col and max-h */}
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Task" : "Create Task"}
          </DialogTitle>
          <DialogDescription>
            {task ? "Edit the details of this task." : "Create a new task for this project."}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow"> {/* Added ScrollArea */}
           {/* TaskForm typically includes its own padding and DialogFooter (via TaskFormActions) */}
          <TaskForm 
            projectId={projectId} 
            task={task} 
            onClose={() => onOpenChange(false)} 
          />
        </ScrollArea>
        {/* Note: TaskForm includes TaskFormActions which renders buttons, akin to a DialogFooter */}
      </DialogContent>
    </Dialog>
  );
}

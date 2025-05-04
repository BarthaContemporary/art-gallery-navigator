
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskWithAssignee } from "@/hooks/use-project-tasks";
import { TaskForm } from "./task-dialog/TaskForm";

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: TaskWithAssignee;
}

export function ProjectTaskDialog({ open, onOpenChange, projectId, task }: ProjectTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Task" : "Create Task"}
          </DialogTitle>
        </DialogHeader>
        
        <TaskForm 
          projectId={projectId} 
          task={task} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
}

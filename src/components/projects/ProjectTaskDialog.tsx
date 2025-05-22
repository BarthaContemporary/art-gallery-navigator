
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Import DialogDescription
import { TaskWithAssignee } from "@/hooks/projects"; // Standardized import
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
          {/* Add DialogDescription here */}
          <DialogDescription>
            {task ? "Edit the details of this task." : "Create a new task for this project."}
          </DialogDescription>
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

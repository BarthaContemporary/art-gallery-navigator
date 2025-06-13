
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogDescription,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { TaskWithAssignee } from "@/hooks/projects";
import { TaskForm } from "./task-dialog/TaskForm";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: TaskWithAssignee;
}

export function ProjectTaskDialog({ open, onOpenChange, projectId, task }: ProjectTaskDialogProps) {
  const { scrollToFirstError } = useScrollableDialog(open, {
    enableKeyboardNavigation: true,
    scrollToErrorOnValidation: true
  });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent size="xl">
        <ScrollableDialogHeader>
          <ScrollableDialogTitle>
            {task ? "Edit Task" : "Create Task"}
          </ScrollableDialogTitle>
          <ScrollableDialogDescription>
            {task ? "Edit the details of this task." : "Create a new task for this project."}
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        
        <ScrollableDialogBody>
          <TaskForm 
            projectId={projectId} 
            task={task} 
            onClose={() => onOpenChange(false)} 
          />
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

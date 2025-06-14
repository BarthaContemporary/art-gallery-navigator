
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectForm } from "./ProjectForm";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithLocation;
}

export function ProjectDialog({ 
  open, 
  onOpenChange, 
  project, 
}: ProjectDialogProps) {
  const { scrollToFirstError } = useScrollableDialog(open, { // scrollContainerRef also available if needed directly
    enableKeyboardNavigation: true,
    scrollToErrorOnValidation: true // This hook option exists, but we ensure explicit call
  });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent size="xl">
        <ScrollableDialogHeader>
          <ScrollableDialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </ScrollableDialogTitle>
          <ScrollableDialogDescription>
            {project ? "Edit the details of this project." : "Create a new project by filling in the details below."}
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        
        <ScrollableDialogBody>
          <ProjectForm 
            project={project} 
            onClose={() => onOpenChange(false)} 
            scrollToFirstError={scrollToFirstError} // Pass scrollToFirstError
          />
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

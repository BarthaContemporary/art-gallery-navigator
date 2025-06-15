import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogBody,
  ScrollableDialogFooter,
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
  const { scrollToFirstError, scrollContainerRef } = useScrollableDialog(open, {
    enableKeyboardNavigation: true,
    scrollToErrorOnValidation: true
  });

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent size="xl" className="p-0 flex flex-col max-h-[90vh]">
        <ScrollableDialogHeader className="px-6 pt-6 pb-2 border-b">
          <ScrollableDialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </ScrollableDialogTitle>
          <ScrollableDialogDescription>
            {project ? "Edit the details of this project." : "Create a new project by filling in the details below."}
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody className="flex-1 min-h-0 px-6 py-6" ref={scrollContainerRef}>
          <ProjectForm 
            project={project} 
            onClose={() => onOpenChange(false)} 
            scrollToFirstError={scrollToFirstError}
          />
        </ScrollableDialogBody>
        <ScrollableDialogFooter />
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

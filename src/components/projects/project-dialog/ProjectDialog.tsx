
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectForm } from "./ProjectForm";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]"> {/* Added flex flex-col and max-h */}
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            {project ? "Edit the details of this project." : "Create a new project by filling in the details below."}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow"> {/* Added ScrollArea */}
          {/* ProjectForm typically includes its own padding and DialogFooter */}
          <ProjectForm 
            project={project} 
            onClose={() => onOpenChange(false)} 
          />
        </ScrollArea>
        {/* Note: ProjectForm includes DialogFooter, so it's not needed here directly */}
      </DialogContent>
    </Dialog>
  );
}


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/use-projects";
import { ProjectForm } from "./project-dialog/ProjectForm";
import { z } from "zod";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithLocation;
}

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </DialogTitle>
        </DialogHeader>
        
        <ProjectForm 
          project={project} 
          onClose={() => onOpenChange(false)} 
        />
      </DialogContent>
    </Dialog>
  );
}

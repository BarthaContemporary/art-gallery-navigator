
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectForm } from "./ProjectForm";
// Tabs components are no longer needed as we remove the members tab from here.
// If ProjectForm itself uses Tabs for internal layout, those would remain.
// For now, assuming Tabs, TabsContent, TabsList, TabsTrigger are for the details/members split.
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { useState, useEffect } from "react";
// ProjectMembersTab is deleted

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithLocation;
  // initialTab is no longer needed
}

export function ProjectDialog({ 
  open, 
  onOpenChange, 
  project, 
}: ProjectDialogProps) {
  // const [activeTab, setActiveTab] = useState<"details" | "members">(initialTab);
  
  // useEffect(() => {
  //   if (open) {
  //     setActiveTab(initialTab);
  //   }
  // }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            {project ? "Edit the details of this project." : "Create a new project by filling in the details below."}
          </DialogDescription>
        </DialogHeader>
        
        {/* Tabs system removed, directly rendering ProjectForm */}
        <ProjectForm 
          project={project} 
          onClose={() => onOpenChange(false)} 
        />
        
      </DialogContent>
    </Dialog>
  );
}


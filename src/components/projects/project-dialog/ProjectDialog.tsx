import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectForm } from "./ProjectForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { ProjectMembersTab } from "./ProjectMembersTab";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithLocation;
  initialTab?: "details" | "members";
}

export function ProjectDialog({ 
  open, 
  onOpenChange, 
  project, 
  initialTab = "details" 
}: ProjectDialogProps) {
  const [activeTab, setActiveTab] = useState<"details" | "members">(initialTab);
  
  // Reset tab when dialog opens/closes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            {project ? "Edit the details of this project or manage its team members." : "Create a new project by filling in the details below."}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "members")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="members" disabled={!project}>Team Members</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <ProjectForm 
              project={project} 
              onClose={() => onOpenChange(false)} 
            />
          </TabsContent>
          
          <TabsContent value="members">
            {project ? (
              <ProjectMembersTab 
                project={project}
                onClose={() => onOpenChange(false)} 
              />
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Save project first to manage team members
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

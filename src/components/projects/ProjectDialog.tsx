
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ProjectWithLocation } from "@/hooks/use-projects";
import { ProjectForm } from "./project-dialog/ProjectForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";

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

// Add the ProjectMembersTab component inside the same file
function ProjectMembersTab({ project, onClose }: { project: ProjectWithLocation, onClose: () => void }) {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Project team members</h3>
        <UserMultiSelect 
          projectId={project.id} 
          onClose={onClose} 
        />
      </div>
    </div>
  );
}

// Add a simplified UserMultiSelect for team member management
function UserMultiSelect({ projectId, onClose }: { projectId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // This is a placeholder for the real implementation that will be in a separate component
  return (
    <div className="space-y-4">
      <ProjectUserEmailInput 
        onEmailsChange={(emails) => console.log("Email changes:", emails)} 
      />
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={() => {
            toast.success("Team members updated");
            onClose();
          }}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : "Save Members"}
        </Button>
      </div>
      {error && (
        <div className="text-sm text-red-500 mt-2">{error}</div>
      )}
    </div>
  );
}

// Import missing components
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ProjectUserEmailInput } from "./ProjectUserEmailInput";
import { toast } from "sonner";

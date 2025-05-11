
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ProjectMemberSelect } from "@/components/projects/ProjectMemberSelect";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectWithLocation } from "@/hooks/projects";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useProjectMembers } from "@/hooks/projects/use-project-members";

interface ProjectMembersTabProps {
  project: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectMembersTab({ project, onClose }: ProjectMembersTabProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: members, isLoading: membersLoading } = useProjectMembers(project.id);

  const handleSaveMembers = async () => {
    setLoading(true);
    
    try {
      // Members are saved directly in the ProjectMemberSelect component
      // Here we just need to refresh the data and close the dialog
      await queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
      toast.success("Team members updated");
      onClose();
    } catch (error) {
      console.error("Error saving members:", error);
      toast.error("Failed to save members");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ErrorBoundary fallback={
      <div className="p-4 text-center">
        <p className="text-red-500 mb-2">Error loading project members</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    }>
      <div className="space-y-6 py-4">
        <h3 className="text-sm font-medium">Project team members</h3>
        
        {membersLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            <span>Loading team members...</span>
          </div>
        ) : (
          <ProjectMemberSelect 
            projectId={project.id}
            initialMembers={members}
          />
        )}
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveMembers}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : "Done"}
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  );
}

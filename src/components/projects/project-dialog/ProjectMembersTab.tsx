
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectWithLocation } from "@/hooks/projects";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ProjectMemberManager } from "@/components/projects/members/ProjectMemberManager";

interface ProjectMembersTabProps {
  project: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectMembersTab({ project, onClose }: ProjectMembersTabProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSaveMembers = async () => {
    setLoading(true);
    
    try {
      // Force invalidate the query to ensure latest data
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
        
        <ProjectMemberManager projectId={project.id} />
        
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

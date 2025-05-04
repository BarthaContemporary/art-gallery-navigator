
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { ProjectWithLocation, useDeleteProject } from "@/hooks/use-projects";
import { useState } from "react";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithLocation | null;
}

export function DeleteProjectDialog({ open, onOpenChange, project }: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteProject = useDeleteProject();
  const { isAdmin } = useAuth();

  if (!project) {
    return null;
  }

  const handleDelete = async () => {
    if (!project) return;
    
    setIsDeleting(true);
    try {
      await deleteProject.mutateAsync({ 
        id: project.id, 
        itemDetails: {
          name: project.name,
          type: project.type,
          status: project.status,
          start_date: project.start_date,
          end_date: project.end_date
        }
      });
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            {isAdmin ? (
              <>
                This will permanently delete the project "{project.name}" and all associated tasks.
                This action cannot be undone.
              </>
            ) : (
              <>
                This will submit a request to delete the project "{project.name}".
                An administrator will review your request.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? "Processing..." : isAdmin ? "Delete" : "Request Deletion"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

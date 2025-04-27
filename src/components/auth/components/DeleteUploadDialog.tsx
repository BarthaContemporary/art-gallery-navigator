
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

interface DeleteUploadDialogProps {
  fileToDelete: { id: string; fileName: string } | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteUploadDialog({ fileToDelete, onOpenChange, onSuccess }: DeleteUploadDialogProps) {
  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      // Extract the filename from the URL to get the storage path
      const filePath = fileToDelete.fileName.split('/').pop() || fileToDelete.fileName;
      
      console.log("Deleting file from storage:", filePath);
      
      // Delete from storage
      const { error } = await supabase
        .storage
        .from('documents')
        .remove([filePath]);

      if (error) {
        console.error("Storage deletion error:", error);
        throw error;
      }

      console.log("File deleted from storage, now removing from database");
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', fileToDelete.id);

      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      toast.success("File deleted", {
        description: "The file has been successfully deleted."
      });

      onSuccess();
    } catch (error: any) {
      console.error("Delete operation failed:", error);
      toast.error("Failed to delete file", {
        description: error.message || "Please try again or contact support."
      });
    } finally {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={!!fileToDelete} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the file. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

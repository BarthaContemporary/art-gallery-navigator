
import { useState } from "react";
import { Collection, useDeleteCollection } from "@/hooks/use-collections";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button"; // Button might be used if AlertDialogAction is customized

interface DeleteCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteCollectionDialog({ collection, open, onOpenChange }: DeleteCollectionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { mutate: deleteCollection } = useDeleteCollection();

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      
      const { data: documents, error: documentsError } = await supabase
        .from("documents")
        .select("id")
        .eq("collection_id", collection.id);
      
      if (documentsError) throw documentsError;
      
      if (documents && documents.length > 0) {
        const { error: deleteDocsError } = await supabase
          .from("documents")
          .delete()
          .eq("collection_id", collection.id);
        
        if (deleteDocsError) throw deleteDocsError;
      }
      
      deleteCollection(collection.id, {
        onSuccess: () => {
          toast.success(`Collection "${collection.name}" deleted successfully`);
          onOpenChange(false);
          setIsDeleting(false);
        },
        onError: (error) => {
          toast.error("Failed to delete collection: " + error.message);
          setIsDeleting(false);
        },
      });
    } catch (error: any) {
      toast.error("Error during deletion: " + error.message);
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the collection "{collection.name}" and remove all artwork associations and documents linked to this collection.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Collection"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

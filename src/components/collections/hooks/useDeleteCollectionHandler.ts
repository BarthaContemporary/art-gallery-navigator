
import { useState } from "react";
import { Collection, useDeleteCollection } from "@/hooks/use-collections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseDeleteCollectionHandlerProps {
  collection: Collection;
  onOpenChange: (open: boolean) => void;
}

export function useDeleteCollectionHandler({ collection, onOpenChange }: UseDeleteCollectionHandlerProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { mutate: deleteCollectionMutation } = useDeleteCollection();

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Check for and delete associated documents first
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

      // Then delete the collection
      deleteCollectionMutation(collection.id, {
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
      toast.error("Error during deletion process: " + error.message);
      setIsDeleting(false);
    }
  };

  return {
    isDeleting,
    confirmDelete,
  };
}

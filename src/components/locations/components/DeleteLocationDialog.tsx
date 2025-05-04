
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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  onConfirm?: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteLocationDialog({ 
  open, 
  onOpenChange,
  locationId,
  onConfirm,
  isDeleting: externalIsDeleting
}: DeleteLocationDialogProps) {
  const [internalIsDeleting, setInternalIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  
  // Use external isDeleting state if provided, otherwise use internal state
  const isDeleting = externalIsDeleting !== undefined ? externalIsDeleting : internalIsDeleting;

  const handleDelete = async () => {
    if (!locationId || isDeleting) return;
    
    // If onConfirm is provided, use that instead of internal delete logic
    if (onConfirm) {
      await onConfirm();
      return;
    }
    
    try {
      setInternalIsDeleting(true);
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      // Invalidate the locations query to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted successfully");
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error("Failed to delete location");
    } finally {
      setInternalIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this location
            and may affect any artworks associated with it.
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
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

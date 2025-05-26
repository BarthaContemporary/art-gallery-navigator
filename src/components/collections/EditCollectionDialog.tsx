
import React, { useCallback } from "react"; // Removed useState, useEffect
import { Collection } from "@/hooks/use-collections";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter, // Added DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditCollectionForm } from "./hooks/useEditCollectionForm"; // New hook
import { EditCollectionFormView } from "./EditCollectionFormView"; // New view

interface EditCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCollectionDialog({ collection, open, onOpenChange }: EditCollectionDialogProps) {
  const {
    name,
    setName,
    description,
    setDescription,
    selectedArtworks,
    toggleArtwork,
    artworks,
    artworksLoading,
    emails,
    currentEmail,
    setCurrentEmail,
    handleAddEmail,
    removeEmail,
    handleSubmit,
    isUpdating,
  } = useEditCollectionForm({
    collection,
    onCloseDialog: () => onOpenChange(false),
  });

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    // Prevents dialog from closing when clicking inside the content,
    // useful if there are interactive elements that might otherwise bubble up.
    e.stopPropagation();
  }, []);

  // The isMounted logic with requestAnimationFrame for onOpenChange(false)
  // is now handled within the hook or simply by calling onOpenChange(false)
  // The hook's success callback for updateCollection uses isMounted.current
  // to safely call onCloseDialog.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col max-h-[90vh]"
        onClick={handleDialogClick} // Keep if still needed for specific interaction patterns
      >
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1">
          <EditCollectionFormView
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            artworks={artworks}
            artworksLoading={artworksLoading}
            selectedArtworks={selectedArtworks}
            onToggleArtwork={toggleArtwork}
            emails={emails}
            currentEmail={currentEmail}
            onCurrentEmailChange={setCurrentEmail}
            onAddEmail={handleAddEmail}
            onRemoveEmail={removeEmail}
            onSubmit={handleSubmit} // Pass the submit handler to the form view
          />
        </ScrollArea>
        <DialogFooter className="pt-4"> {/* Added pt-4 for spacing, ensure DialogFooter is imported */}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => handleSubmit()} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useCallback } from "react";
import { Collection } from "@/hooks/use-collections";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogFooter,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { Button } from "@/components/ui/button";
import { useEditCollectionForm } from "./hooks/useEditCollectionForm";
import { EditCollectionFormView } from "./EditCollectionFormView";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

interface EditCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCollectionDialog({ collection, open, onOpenChange }: EditCollectionDialogProps) {
  const { scrollToFirstError } = useScrollableDialog(open, {
    restoreScrollPosition: true,
    enableKeyboardNavigation: true
  });

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
    e.stopPropagation();
  }, []);

  return (
    <ScrollableDialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        size="xl"
        onClick={handleDialogClick}
        className="flex flex-col h-[90vh] max-h-[90vh] min-h-0 p-0"
      >
        <ScrollableDialogHeader />
        <ScrollableDialogBody className="flex-1 min-h-0">
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
            onSubmit={handleSubmit}
          />
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={() => { handleSubmit(); scrollToFirstError(); }} 
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Collection"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

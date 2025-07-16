import { useState } from "react";
import { useArtworks } from "@/hooks/use-artworks";
import { Button } from "@/components/ui/button";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogFooter,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogTrigger,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { PlusCircle } from "lucide-react";
import { useCreateCollectionForm } from "./hooks/useCreateCollectionForm";
import { CreateCollectionFormView } from "./CreateCollectionFormView";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

export function CollectionDialog({ afterCreate }: { afterCreate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: artworks, isLoading: artworksLoading } = useArtworks();

  const { scrollToFirstError, scrollContainerRef } = useScrollableDialog(open, {
    enableKeyboardNavigation: true
  });

  const {
    name,
    setName,
    description,
    setDescription,
    selectedArtworks,
    toggleArtwork,
    emails,
    currentEmail,
    setCurrentEmail,
    handleAddEmail,
    removeEmail,
    handleCreate,
    resetForm,
    isCreating,
  } = useCreateCollectionForm({
    afterCreate,
    onCloseDialog: () => setOpen(false),
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    setOpen(isOpen);
  };

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogTrigger asChild>
        <Button size="sm" className="flex items-center gap-2 font-medium">
          <PlusCircle className="h-4 w-4" />
          Add Collection
        </Button>
      </ScrollableDialogTrigger>
      <ScrollableDialogContent size="xl" className="p-0">
        <ScrollableDialogHeader />
        <ScrollableDialogBody className="flex-1 min-h-0" ref={scrollContainerRef}>
          <CreateCollectionFormView
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            artworks={artworks || []}
            artworksLoading={artworksLoading}
            selectedArtworks={selectedArtworks}
            onToggleArtwork={toggleArtwork}
            emails={emails}
            currentEmail={currentEmail}
            onCurrentEmailChange={setCurrentEmail}
            onAddEmail={handleAddEmail}
            onRemoveEmail={removeEmail}
          />
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => { handleCreate(); scrollToFirstError(); }} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}


import { useState } from "react";
import { useArtworks } from "@/hooks/use-artworks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateCollectionForm } from "./hooks/useCreateCollectionForm";
import { CreateCollectionFormView } from "./CreateCollectionFormView";

export function CollectionDialog({ afterCreate }: { afterCreate?: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: artworks, isLoading: artworksLoading } = useArtworks();

  const {
    name,
    setName,
    description,
    setDescription,
    selectedArtworks,
    toggleArtwork,
    emails,
    // setEmails is not directly used by view, but managed by hook
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex gap-2">
          <PlusCircle className="h-3 w-3 md:h-4 md:w-4" />
          Add Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Group artworks by concept, period, or exhibition.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1">
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
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


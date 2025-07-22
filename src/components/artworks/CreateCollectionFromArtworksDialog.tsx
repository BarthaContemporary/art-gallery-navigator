
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { FolderPlus } from "lucide-react";
import { useCreateCollectionFromArtworks } from "./hooks/useCreateCollectionFromArtworks";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import type { Artwork } from "@/types/artwork";

interface CreateCollectionFromArtworksDialogProps {
  filteredArtworks: Artwork[];
  children?: React.ReactNode;
}

export function CreateCollectionFromArtworksDialog({ 
  filteredArtworks,
  children 
}: CreateCollectionFromArtworksDialogProps) {
  const [open, setOpen] = useState(false);

  const { scrollToFirstError, scrollContainerRef } = useScrollableDialog(open, {
    enableKeyboardNavigation: true
  });

  const {
    title,
    setTitle,
    description,
    setDescription,
    includeAllArtworks,
    setIncludeAllArtworks,
    selectedArtworkIds,
    toggleArtwork,
    canCreate,
    handleCreate,
    resetForm,
    isCreating,
    filteredArtworksCount,
  } = useCreateCollectionFromArtworks({
    filteredArtworks,
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
        {children || (
          <Button variant="outline" size="icon" title="New Collection">
            <FolderPlus className="h-4 w-4" />
          </Button>
        )}
      </ScrollableDialogTrigger>
      <ScrollableDialogContent size="xl" className="p-0">
        <ScrollableDialogHeader className="px-6 py-4">
          <ScrollableDialogTitle>Create New Collection</ScrollableDialogTitle>
          <ScrollableDialogDescription>
            Create a new collection from the currently displayed artworks
          </ScrollableDialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody className="flex-1 min-h-0 px-6" ref={scrollContainerRef}>
          <div className="space-y-6">
            {/* Collection Title */}
            <div className="space-y-2">
              <Label htmlFor="collection-title">
                Collection Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="collection-title"
                placeholder="Enter collection title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={!title.trim() && title.length > 0 ? "border-destructive" : ""}
              />
            </div>

            {/* Collection Description */}
            <div className="space-y-2">
              <Label htmlFor="collection-description">Description</Label>
              <Textarea
                id="collection-description"
                placeholder="Enter collection description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Artwork Selection */}
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Artwork Selection</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-all"
                    checked={includeAllArtworks}
                    onCheckedChange={(checked) => setIncludeAllArtworks(checked === true)}
                  />
                  <Label htmlFor="include-all" className="text-sm">
                    Include all displayed artworks ({filteredArtworksCount} artworks)
                  </Label>
                </div>
              </div>

              {!includeAllArtworks && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Select artworks ({selectedArtworkIds.length} selected)
                  </Label>
                  <div className="max-h-64 overflow-y-auto border rounded-md p-3 space-y-2">
                    {filteredArtworks.map((artwork) => (
                      <div key={artwork.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`artwork-${artwork.id}`}
                          checked={selectedArtworkIds.includes(artwork.id)}
                          onCheckedChange={() => toggleArtwork(artwork.id)}
                        />
                        <Label 
                          htmlFor={`artwork-${artwork.id}`} 
                          className="text-sm flex-1 cursor-pointer"
                        >
                          <div className="flex items-center space-x-3">
                            {artwork.image_url && (
                              <img
                                src={artwork.image_url}
                                alt={artwork.title}
                                className="w-8 h-8 object-cover rounded"
                              />
                            )}
                            <div>
                              <div className="font-medium">{artwork.title}</div>
                              <div className="text-muted-foreground">
                                {artwork.artist_name}
                                {artwork.year && ` • ${artwork.year}`}
                              </div>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Validation Messages */}
            {!canCreate && (
              <div className="text-sm text-muted-foreground space-y-1">
                {!title.trim() && <div>• Collection title is required</div>}
                {(includeAllArtworks ? filteredArtworksCount : selectedArtworkIds.length) === 0 && (
                  <div>• At least one artwork must be selected</div>
                )}
              </div>
            )}
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter className="px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => { handleCreate(); scrollToFirstError(); }} 
            disabled={!canCreate || isCreating}
          >
            {isCreating ? "Creating..." : "Create Collection"}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

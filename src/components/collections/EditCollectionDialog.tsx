
import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateCollection } from "@/hooks/use-collections";
import { useArtworks } from "@/hooks/use-artworks";
import { toast } from "sonner";

interface EditCollectionDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCollectionDialog({ collection, open, onOpenChange }: EditCollectionDialogProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>(
    collection.artworks?.map(artwork => artwork.id) || []
  );
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const { mutate: updateCollection, isPending } = useUpdateCollection();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCollection(
      { 
        id: collection.id, 
        name, 
        description,
        artworkIds: selectedArtworks
      },
      {
        onSuccess: () => {
          toast.success("Collection updated successfully");
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error("Failed to update collection: " + error.message);
        },
      }
    );
  };

  const toggleArtwork = (id: string) => {
    setSelectedArtworks(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Artworks</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/50">
              {artworksLoading ? (
                <span className="text-xs text-muted-foreground">Loading artworks…</span>
              ) : (
                artworks?.map((artwork) => (
                  <label key={artwork.id} className="flex items-center gap-2 text-sm cursor-pointer border-b last:border-b-0 py-1">
                    <input
                      type="checkbox"
                      checked={selectedArtworks.includes(artwork.id)}
                      onChange={() => toggleArtwork(artwork.id)}
                      className="accent-primary"
                    />
                    {artwork.title}
                  </label>
                ))
              )}
              {artworks?.length === 0 && (
                <span className="text-xs text-muted-foreground">No artworks available</span>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating..." : "Update Collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

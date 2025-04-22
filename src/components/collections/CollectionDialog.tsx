
import { useState } from "react";
import { useCreateCollection } from "@/hooks/use-collections";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function CollectionDialog({ afterCreate }: { afterCreate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([]);
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const createCollection = useCreateCollection();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the collection.");
      return;
    }

    createCollection.mutate(
      {
        name,
        description,
        artworkIds: selectedArtworks,
      },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          setOpen(false);
          setName("");
          setDescription("");
          setSelectedArtworks([]);
          afterCreate && afterCreate();
        },
        onError: () => {
          toast.error("Failed to create collection.");
        },
      }
    );
  };

  const toggleArtwork = (id: string) => {
    setSelectedArtworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New Collection</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Group artworks by concept, period, or exhibition.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Select Artworks</p>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted">
              {artworksLoading ? (
                <span className="text-xs text-muted-foreground">Loading artworks…</span>
              ) : (
                artworks &&
                artworks.length > 0 &&
                artworks.map((artwork) => (
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
              {artworks && artworks.length === 0 && (
                <span className="text-xs text-muted-foreground">No artworks available</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createCollection.isPending}>
            {createCollection.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

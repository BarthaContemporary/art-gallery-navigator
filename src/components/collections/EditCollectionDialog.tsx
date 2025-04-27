
import { useState, useCallback } from "react";
import { Collection } from "@/hooks/use-collections";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateCollection } from "@/hooks/use-collections";
import { useArtworks } from "@/hooks/use-artworks";
import { toast } from "sonner";
import { ArtworkSearch } from "./ArtworkSearch";
import { X } from "lucide-react";

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
  const [emails, setEmails] = useState<string[]>(collection.external_emails || []);
  const [currentEmail, setCurrentEmail] = useState("");
  const [isMounted, setIsMounted] = useState(true);
  
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const { mutate: updateCollection, isPending } = useUpdateCollection();

  // Use memoized event handler to prevent re-renders
  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for the collection.");
      return;
    }

    // Use a small timeout to prevent UI freezing
    setTimeout(() => {
      updateCollection(
        { 
          id: collection.id, 
          name, 
          description,
          artworkIds: selectedArtworks,
          externalEmails: emails.length > 0 ? emails : undefined
        },
        {
          onSuccess: () => {
            toast.success("Collection updated successfully");
            // Use requestAnimationFrame for smoother transitions
            requestAnimationFrame(() => {
              if (isMounted) {
                onOpenChange(false);
              }
            });
          },
          onError: (error) => {
            toast.error("Failed to update collection: " + error.message);
          },
        }
      );
    }, 0);
  }, [name, description, selectedArtworks, emails, collection.id, updateCollection, onOpenChange, isMounted]);

  const toggleArtwork = useCallback((id: string) => {
    setSelectedArtworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleAddEmail = useCallback(() => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      if (!emails.includes(currentEmail)) {
        setEmails(prev => [...prev, currentEmail]);
        setCurrentEmail("");
      } else {
        toast.error("Email already added");
      }
    } else if (currentEmail) {
      toast.error("Please enter a valid email address");
    }
  }, [currentEmail, emails]);

  const removeEmail = useCallback((emailToRemove: string) => {
    setEmails(emails => emails.filter(email => email !== emailToRemove));
  }, []);

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Add a slight delay when closing to ensure state is properly handled
        if (!newOpen) {
          requestAnimationFrame(() => {
            onOpenChange(false);
          });
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent onClick={handleDialogClick}>
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
          <div>
            <Label>Artworks</Label>
            {artworksLoading ? (
              <span className="text-xs text-muted-foreground">Loading artworks…</span>
            ) : (
              <ArtworkSearch
                artworks={artworks || []}
                selectedArtworks={selectedArtworks}
                onToggleArtwork={toggleArtwork}
              />
            )}
          </div>
          <div>
            <Label htmlFor="email">External Users (Optional)</Label>
            <div className="flex gap-2 mb-2">
              <Input
                id="email"
                type="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                placeholder="Enter email address"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
              />
              <Button type="button" onClick={handleAddEmail} variant="secondary">
                Add
              </Button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {emails.map((email) => (
                  <div key={email} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                    <span className="text-sm">{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => removeEmail(email)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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

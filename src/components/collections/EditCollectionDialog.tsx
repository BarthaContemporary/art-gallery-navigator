
import { useState, useCallback, useEffect } from "react"; // Added useEffect
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
import { ScrollArea } from "@/components/ui/scroll-area"; // Added ScrollArea import

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

  useEffect(() => {
    // Reset form fields when dialog is opened or collection changes
    if (open) {
      setName(collection.name);
      setDescription(collection.description || "");
      setSelectedArtworks(collection.artworks?.map(artwork => artwork.id) || []);
      setEmails(collection.external_emails || []);
      setCurrentEmail("");
    }
    // Cleanup isMounted on unmount
    return () => {
      setIsMounted(false);
    };
  }, [open, collection, setIsMounted]); // Added setIsMounted to dependencies

  const handleDialogClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for the collection.");
      return;
    }

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
        if (!newOpen) {
          requestAnimationFrame(() => {
             if (isMounted) onOpenChange(false); // check isMounted before calling
          });
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent 
        className="flex flex-col max-h-[90vh]"  // Modified className
        onClick={handleDialogClick}
      >
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1"> {/* Added ScrollArea */}
          <form onSubmit={handleSubmit} className="space-y-4 p-4"> {/* Added p-4 for content padding */}
            <div className="space-y-2">
              <Label htmlFor="name_edit_collection">Name</Label> {/* Ensured unique ID */}
              <Input
                id="name_edit_collection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description_edit_collection">Description</Label> {/* Ensured unique ID */}
              <Textarea
                id="description_edit_collection"
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
              <Label htmlFor="email_edit_collection">External Users (Optional)</Label> {/* Ensured unique ID */}
              <div className="flex gap-2 mb-2">
                <Input
                  id="email_edit_collection"
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
            <div className="flex justify-end gap-2 pt-4"> {/* Added pt-4 for spacing */}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Updating..." : "Update Collection"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


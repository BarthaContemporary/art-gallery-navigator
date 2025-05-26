
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArtworkSearch } from "./ArtworkSearch";
import { PlusCircle, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area"; // Added ScrollArea import

export function CollectionDialog({ afterCreate }: { afterCreate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
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
        externalEmails: emails.length > 0 ? emails : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          setOpen(false);
          setName("");
          setDescription("");
          setSelectedArtworks([]);
          setEmails([]);
          afterCreate && afterCreate();
        },
        onError: (error) => {
          console.error("Error creating collection:", error);
          toast.error("Failed to create collection.");
        },
      }
    );
  };

  const handleAddEmail = () => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      if (!emails.includes(currentEmail)) {
        setEmails([...emails, currentEmail]);
        setCurrentEmail("");
      } else {
        toast.error("Email already added");
      }
    } else if (currentEmail) {
      toast.error("Please enter a valid email address");
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const toggleArtwork = (id: string) => {
    setSelectedArtworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col max-h-[90vh]"> {/* Modified className */}
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Group artworks by concept, period, or exhibition.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1"> {/* Added ScrollArea */}
          <div className="space-y-4 py-2 px-4"> {/* Added px-4 for content padding */}
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Select Artworks</p>
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
              <label className="block text-sm font-medium mb-1">External Users (Optional)</label>
              <div className="flex gap-2 mb-2">
                <Input
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
          </div>
        </ScrollArea>
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


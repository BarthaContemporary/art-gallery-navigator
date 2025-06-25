
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderPlus } from "lucide-react";
import { useCreateFolder } from "@/hooks/use-folders";
import { useArtists } from "@/hooks/useArtists";
import { useAuth } from "@/hooks/use-auth";

interface CreateFolderDialogProps {
  parentFolderId?: string | null;
  artistId?: string | null;
}

export function CreateFolderDialog({ parentFolderId, artistId }: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(artistId || null);

  const { isAdmin } = useAuth();
  const { data: artists = [] } = useArtists();
  const createFolder = useCreateFolder();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    try {
      await createFolder.mutateAsync({
        name: name.trim(),
        parentFolderId,
        artistId: selectedArtistId === "none" ? null : selectedArtistId,
      });
      
      setOpen(false);
      setName("");
      setSelectedArtistId(artistId || null);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your files.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Enter folder name"
                required
              />
            </div>
            
            {isAdmin && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="artist" className="text-right">
                  Assign to Artist
                </Label>
                <Select value={selectedArtistId || "none"} onValueChange={setSelectedArtistId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select an artist (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No artist assignment</SelectItem>
                    {artists.map((artist) => (
                      <SelectItem key={artist.id} value={artist.id}>
                        {artist.full_name}
                        {artist.user_id ? " (linked)" : " (not linked)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFolder.isPending}>
              {createFolder.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

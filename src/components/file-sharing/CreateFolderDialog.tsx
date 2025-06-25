
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
import { FolderPlus } from "lucide-react";
import { useCreateFolder, useFolderAccess } from "@/hooks/use-folders";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { useAuth } from "@/hooks/use-auth";

interface CreateFolderDialogProps {
  parentFolderId?: string | null;
  artistId?: string | null;
}

export function CreateFolderDialog({ parentFolderId, artistId }: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createFolder = useCreateFolder();
  const currentUserArtist = useCurrentUserArtist();
  const { isAdmin } = useAuth();
  
  // Check access to parent folder if creating a subfolder
  const { data: folderAccess } = useFolderAccess(parentFolderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createFolder.mutateAsync({
        name: name.trim(),
        parentFolderId,
        artistId,
      });
      setName("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  // Determine if user can create folders
  const canCreateFolder = () => {
    // Admins can always create folders
    if (isAdmin) return true;
    
    // If creating a root folder, user must be an artist
    if (!parentFolderId) {
      return !!currentUserArtist;
    }
    
    // If creating a subfolder, check parent folder access
    return folderAccess?.can_access ?? false;
  };

  // Don't show the button if user cannot create folders
  if (!canCreateFolder()) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            {parentFolderId 
              ? "Create a new subfolder in the current location."
              : "Create a new folder in your file space."
            }
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
                placeholder="Folder name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || createFolder.isPending}
            >
              {createFolder.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

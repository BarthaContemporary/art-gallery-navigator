/**
 * Dialog for creating a collection from selected artworks
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateCollection } from "@/hooks/use-collections";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filteredArtworks: Artwork[];
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  filteredArtworks,
}: CreateCollectionDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  const navigate = useNavigate();
  const createCollectionMutation = useCreateCollection();

  const canCreate = title.trim().length > 0 && filteredArtworks.length > 0;

  const handleCreate = async () => {
    if (!canCreate) return;

    const artworkIds = filteredArtworks.map(artwork => artwork.id);
    
    createCollectionMutation.mutate(
      {
        name: title,
        description: description || undefined,
        artworkIds,
      },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          resetForm();
          onOpenChange(false);
          navigate("/collections");
        },
        onError: (error) => {
          console.error("Error creating collection:", error);
          toast.error("Failed to create collection.");
        },
      }
    );
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Collection from Selected Artworks</DialogTitle>
          <DialogDescription>
            Create a new collection with {filteredArtworks.length} selected artwork{filteredArtworks.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
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

              {/* Selected Artworks Preview */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Selected Artworks ({filteredArtworks.length})
                </Label>
                <div className="max-h-64 overflow-y-auto border rounded-md p-3 space-y-2">
                  {filteredArtworks.map((artwork) => (
                    <div key={artwork.id} className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
                      {artwork.image_url && (
                        <img
                          src={artwork.image_url}
                          alt={artwork.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{artwork.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {artwork.artist_name}
                          {artwork.year && ` • ${artwork.year}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Messages */}
              {!canCreate && (
                <div className="text-sm text-muted-foreground space-y-1">
                  {!title.trim() && <div>• Collection title is required</div>}
                  {filteredArtworks.length === 0 && (
                    <div>• At least one artwork must be selected</div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!canCreate || createCollectionMutation.isPending}
          >
            {createCollectionMutation.isPending ? "Creating..." : "Create Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
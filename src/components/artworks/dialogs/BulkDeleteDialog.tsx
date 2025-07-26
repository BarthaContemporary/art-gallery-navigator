/**
 * Confirmation dialog for bulk deleting artworks
 */

import React, { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Artwork } from "@/types/artwork";

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworks: Artwork[];
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  artworks,
  onConfirm,
  isDeleting = false,
}: BulkDeleteDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const expectedText = "DELETE";
  const canDelete = confirmationText === expectedText;

  const handleConfirm = async () => {
    if (!canDelete) return;
    await onConfirm();
    setConfirmationText("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setConfirmationText("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-left">
                Delete {artworks.length} artwork{artworks.length !== 1 ? 's' : ''}?
              </AlertDialogTitle>
            </div>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogDescription className="text-left space-y-4">
          <p>
            This action cannot be undone. This will permanently delete the selected artworks and all associated data.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          
          {artworks.length <= 5 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Artworks to be deleted:</p>
              <div className="text-sm text-muted-foreground space-y-1">
                {artworks.map((artwork) => (
                  <div key={artwork.id} className="truncate">
                    • {artwork.title} by {artwork.artist_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canDelete || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {artworks.length} artwork{artworks.length !== 1 ? 's' : ''}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
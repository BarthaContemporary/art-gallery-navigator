
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { ArtworkImageManager } from "./ArtworkImageManager";
import { Artwork } from "@/hooks/use-artworks";
import { useCallback, useEffect, useState } from "react";

interface EditArtworkDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditArtworkDialog({ artwork, open, onOpenChange }: EditArtworkDialogProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [debugKey, setDebugKey] = useState(0);
  
  useEffect(() => {
    console.log("🔧 EditArtworkDialog mounted/updated - New scrollable layout should be visible");
    setIsMounted(true);
    setDebugKey(prev => prev + 1);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      console.log("🔧 EditArtworkDialog opened - checking for scrollable content and image manager");
    }
  }, [open]);

  const handleDialogInteraction = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isMounted) return;
    
    if (newOpen === false) {
      window.requestAnimationFrame(() => {
        onOpenChange(false);
      });
    } else {
      onOpenChange(true);
    }
  }, [onOpenChange, isMounted]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        key={`edit-dialog-${debugKey}`}
        className="max-w-2xl max-h-[90vh] flex flex-col bg-red-50 border-4 border-red-500"
        onClick={handleDialogInteraction}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 pb-4 bg-blue-100 border-2 border-blue-500">
          <DialogTitle>🔧 Edit Artwork (Debug Mode)</DialogTitle>
          <DialogDescription>
            DEBUG: This should show new layout with scrollable content below
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-yellow-100 p-2 border-2 border-yellow-500 text-sm">
          🔧 DEBUG: Scroll area should be visible below this line
        </div>
        
        <ScrollArea className="flex-1 pr-4 bg-green-50 border-2 border-green-500 min-h-[200px]">
          <div className="space-y-6 p-4">
            <div className="bg-purple-100 p-2 border border-purple-500">
              🔧 DEBUG: Form section (scrollable content)
            </div>
            
            <CreateArtworkForm 
              setOpen={onOpenChange} 
              initialData={artwork} 
              preventFreeze={true}
              hideSubmitButton={true}
            />
            
            <div className="border-t pt-4 bg-orange-100">
              <div className="mb-2 p-2 bg-orange-200 border border-orange-500">
                🔧 DEBUG: Image manager section below
              </div>
              <ArtworkImageManager artworkId={artwork.id} />
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="flex-shrink-0 pt-4 border-t bg-pink-100 border-2 border-pink-500">
          <div className="text-xs text-gray-600 mb-2">
            🔧 DEBUG: Fixed footer with buttons
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="edit-artwork-form"
          >
            Update Artwork
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

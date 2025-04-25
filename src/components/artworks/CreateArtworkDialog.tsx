
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CreateArtworkDialog() {
  const [open, setOpen] = useState(false);
  
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Artwork
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add New Artwork</DialogTitle>
          <DialogDescription>
            Enter artwork details below to add it to your inventory.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-8rem)] pr-4">
          <CreateArtworkForm setOpen={setOpen} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

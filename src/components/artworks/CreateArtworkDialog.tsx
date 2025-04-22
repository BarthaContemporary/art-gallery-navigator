
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CreateArtworkDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Artwork
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Artwork</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-8rem)] pr-4">
          <CreateArtworkForm setOpen={setOpen} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

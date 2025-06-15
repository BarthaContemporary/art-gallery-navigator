import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
  ScrollableDialogBody,
  ScrollableDialogTrigger,
} from "@/components/ui/scrollable-dialog";
import { PlusCircle } from "lucide-react";
import { CreateArtworkForm } from "./CreateArtworkForm";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";

export function CreateArtworkDialog() {
  const [open, setOpen] = useState(false);
  
  const { scrollToFirstError, scrollContainerRef } = useScrollableDialog(open, {
    scrollToErrorOnValidation: true,
    enableKeyboardNavigation: true
  });
  
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  return (
    <ScrollableDialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Artwork
        </Button>
      </ScrollableDialogTrigger>
      <ScrollableDialogContent 
        size="2xl"
        onClick={(e) => e.stopPropagation()}
        className="p-0"
      >
        <ScrollableDialogHeader />
        <ScrollableDialogBody className="flex-1 min-h-0" ref={scrollContainerRef}>
          <CreateArtworkForm setOpen={setOpen} />
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
}

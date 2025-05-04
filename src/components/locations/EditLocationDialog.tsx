
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LocationForm } from "./LocationForm";
import { Location } from "@/hooks/use-locations";
import { useState } from "react";

interface EditLocationDialogProps {
  location: Location;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLocationDialog({ location, open, onOpenChange }: EditLocationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>
            Make changes to location details. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <LocationForm initialData={location} setOpen={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

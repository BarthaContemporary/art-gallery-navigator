
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LocationForm } from "./LocationForm";
import { Location } from "@/hooks/use-locations";

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
        </DialogHeader>
        <LocationForm initialData={location} setOpen={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

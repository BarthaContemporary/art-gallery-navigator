
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientDetailsHeader } from "./ClientDetailsHeader";
import { ClientContactSection } from "./ClientContactSection";
import { ClientProfessionalSection } from "./ClientProfessionalSection";
import { ClientLocationSection } from "./ClientLocationSection";
import { ClientTagsSection } from "./ClientTagsSection";
import { ClientNotesSection } from "./ClientNotesSection";

interface ClientDetailsDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle>
            <ClientDetailsHeader client={client} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ClientContactSection client={client} />
          <ClientProfessionalSection client={client} />
          <ClientLocationSection client={client} />
        </div>

        <ClientTagsSection client={client} />
        <ClientNotesSection client={client} />

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

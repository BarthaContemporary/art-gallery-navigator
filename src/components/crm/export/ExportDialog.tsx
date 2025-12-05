import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useExportToCSV, useExportToGoogleContacts } from "@/hooks/crm";
import { CRMContact } from "@/types/crm";
import { Download, Users } from "lucide-react";

interface ExportDialogProps { open: boolean; onOpenChange: (open: boolean) => void; contacts: CRMContact[]; sourceType: string; sourceId?: string; sourceName: string; }

export function ExportDialog({ open, onOpenChange, contacts, sourceType, sourceId, sourceName }: ExportDialogProps) {
  const exportCSV = useExportToCSV();
  const exportGoogleContacts = useExportToGoogleContacts();

  const handleExportCSV = () => {
    exportCSV.mutate({ sourceType: sourceType as any, sourceId, sourceName, contacts }, { onSuccess: () => onOpenChange(false) });
  };

  const handleExportGoogleContacts = () => {
    exportGoogleContacts.mutate({ sourceType: sourceType as any, sourceId, sourceName, contacts }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Export {contacts.length} Contacts</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Button className="w-full justify-start" variant="outline" onClick={handleExportCSV} disabled={exportCSV.isPending}>
            <Download className="h-4 w-4 mr-2" />Export as CSV
          </Button>
          <Button className="w-full justify-start" variant="outline" onClick={handleExportGoogleContacts} disabled={exportGoogleContacts.isPending}>
            <Users className="h-4 w-4 mr-2" />Export for Google Contacts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

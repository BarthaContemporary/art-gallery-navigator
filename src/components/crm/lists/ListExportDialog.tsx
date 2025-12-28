import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CRMList, CRMContact } from "@/types/crm";
import { useExportToCSV, useExportToGoogleContacts } from "@/hooks/crm";
import { Download, Mail, FileText, Users, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ListExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: CRMList;
  contacts: CRMContact[];
}

export function ListExportDialog({ open, onOpenChange, list, contacts }: ListExportDialogProps) {
  const [format, setFormat] = useState("csv");
  const exportCSV = useExportToCSV();
  const exportGoogleContacts = useExportToGoogleContacts();

  const handleExport = async () => {
    if (contacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }

    const exportOptions = {
      sourceType: 'list' as const,
      sourceId: list.id,
      sourceName: list.name,
      contacts,
    };

    switch (format) {
      case "csv":
        await exportCSV.mutateAsync(exportOptions);
        break;
      case "email_csv":
        // Export only email fields
        await exportCSV.mutateAsync({
          ...exportOptions,
          includeFields: ['full_name', 'email'],
        });
        break;
      case "google":
        await exportGoogleContacts.mutateAsync(exportOptions);
        break;
      case "vcard":
        exportVCard(contacts, list.name);
        break;
      case "mailing":
        exportMailingLabels(contacts, list.name);
        break;
    }
    
    onOpenChange(false);
  };

  const exportVCard = (contacts: CRMContact[], listName: string) => {
    const vcards = contacts.map(contact => {
      const nameParts = contact.full_name.split(' ');
      const firstName = contact.first_name || nameParts[0] || '';
      const lastName = contact.last_name || nameParts.slice(1).join(' ') || '';
      
      let vcard = `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${contact.full_name}`;
      
      if (contact.email) vcard += `\nEMAIL;TYPE=WORK:${contact.email}`;
      if (contact.phone) vcard += `\nTEL;TYPE=WORK:${contact.phone}`;
      if (contact.organization?.name) vcard += `\nORG:${contact.organization.name}`;
      if (contact.job_title) vcard += `\nTITLE:${contact.job_title}`;
      if (contact.address_line1) {
        vcard += `\nADR;TYPE=WORK:;;${contact.address_line1};${contact.city || ''};${contact.state || ''};${contact.postal_code || ''};${contact.country || ''}`;
      }
      if (contact.linkedin_handle) vcard += `\nURL:https://linkedin.com/in/${contact.linkedin_handle}`;
      if (contact.instagram_handle) vcard += `\nX-SOCIALPROFILE;TYPE=instagram:${contact.instagram_handle}`;
      
      vcard += '\nEND:VCARD';
      return vcard;
    });

    const blob = new Blob([vcards.join('\n\n')], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${listName}_contacts.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contacts.length} contacts as vCard`);
  };

  const exportMailingLabels = (contacts: CRMContact[], listName: string) => {
    // Filter contacts with addresses
    const contactsWithAddress = contacts.filter(c => c.address_line1 && c.city);
    
    if (contactsWithAddress.length === 0) {
      toast.error("No contacts have complete addresses");
      return;
    }

    // Create mailing label CSV
    const header = ['Name', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Postal Code', 'Country'].join(',');
    const rows = contactsWithAddress.map(contact => [
      `"${contact.full_name}"`,
      `"${contact.address_line1 || ''}"`,
      `"${contact.address_line2 || ''}"`,
      `"${contact.city || ''}"`,
      `"${contact.state || ''}"`,
      `"${contact.postal_code || ''}"`,
      `"${contact.country || ''}"`,
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${listName}_mailing_labels.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contactsWithAddress.length} mailing addresses`);
  };

  const isPending = exportCSV.isPending || exportGoogleContacts.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {list.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{contacts.length} contacts in this list</p>
          
          <RadioGroup value={format} onValueChange={setFormat} className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setFormat("csv")}>
              <RadioGroupItem value="csv" id="csv" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="csv" className="font-medium cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4" />Full CSV Export
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">All contact fields including social, notes, tags</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setFormat("email_csv")}>
              <RadioGroupItem value="email_csv" id="email_csv" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="email_csv" className="font-medium cursor-pointer flex items-center gap-2">
                  <Mail className="h-4 w-4" />Email List CSV
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Name and email only - for email campaigns</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setFormat("google")}>
              <RadioGroupItem value="google" id="google" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="google" className="font-medium cursor-pointer flex items-center gap-2">
                  <Users className="h-4 w-4" />Google Contacts Format
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Compatible with Google Contacts import</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setFormat("vcard")}>
              <RadioGroupItem value="vcard" id="vcard" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="vcard" className="font-medium cursor-pointer flex items-center gap-2">
                  <Users className="h-4 w-4" />vCard (.vcf)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Universal contact format - works with most apps</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setFormat("mailing")}>
              <RadioGroupItem value="mailing" id="mailing" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mailing" className="font-medium cursor-pointer flex items-center gap-2">
                  <MapPin className="h-4 w-4" />Mailing Labels CSV
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Address fields only - for printing labels</p>
              </div>
            </div>
          </RadioGroup>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={isPending || contacts.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {isPending ? "Exporting..." : "Export"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

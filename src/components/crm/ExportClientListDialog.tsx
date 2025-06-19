
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowDown, FileText, Mail, FileSpreadsheet } from "lucide-react";
import { useExportClientList } from "./hooks/useExportClientList";

interface ExportClientListDialogProps {
  selectedListId?: string;
  clientsData: any[];
}

export function ExportClientListDialog({ selectedListId, clientsData }: ExportClientListDialogProps) {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"email-csv" | "mailing-labels" | "fact-sheets">("email-csv");
  const { exportEmailList, exportMailingLabels, exportFactSheets, isExporting } = useExportClientList();

  const handleExport = async () => {
    if (!clientsData?.length) return;

    try {
      switch (exportFormat) {
        case "email-csv":
          await exportEmailList(clientsData, selectedListId);
          break;
        case "mailing-labels":
          await exportMailingLabels(clientsData, selectedListId);
          break;
        case "fact-sheets":
          await exportFactSheets(clientsData, selectedListId);
          break;
      }
      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <ArrowDown className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Client List</DialogTitle>
          <DialogDescription>
            Choose how you'd like to export your client data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="email-csv" id="email-csv" />
              <Label htmlFor="email-csv" className="flex items-center gap-2 cursor-pointer">
                <Mail className="h-4 w-4" />
                Email List (CSV)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mailing-labels" id="mailing-labels" />
              <Label htmlFor="mailing-labels" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Mailing Labels (Google Docs)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fact-sheets" id="fact-sheets" />
              <Label htmlFor="fact-sheets" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Fact Sheets (Google Sheets)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !clientsData?.length}>
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

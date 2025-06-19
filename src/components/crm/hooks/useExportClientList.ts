
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useExportClientList() {
  const [isExporting, setIsExporting] = useState(false);

  const exportEmailList = async (clients: any[], listId?: string) => {
    setIsExporting(true);
    try {
      // Create CSV content with just name and email
      const csvHeaders = ["Name", "Email"];
      const csvRows = clients
        .filter(client => client.email) // Only include clients with email
        .map(client => [
          `"${client.full_name || ''}"`,
          `"${client.email || ''}"`
        ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map(row => row.join(","))
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `client-emails-${listId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${csvRows.length} client emails to CSV`);
    } catch (error) {
      console.error("Email export failed:", error);
      toast.error("Failed to export email list");
    } finally {
      setIsExporting(false);
    }
  };

  const exportMailingLabels = async (clients: any[], listId?: string) => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-mailing-labels', {
        body: {
          clients: clients.filter(client => client.address), // Only clients with addresses
          listId,
          labelFormat: 'L7165' // A4, 8 labels (2x4)
        }
      });

      if (error) throw error;

      if (data?.documentUrl) {
        window.open(data.documentUrl, '_blank');
        toast.success("Mailing labels created in Google Docs");
      } else {
        throw new Error("No document URL returned");
      }
    } catch (error) {
      console.error("Mailing labels export failed:", error);
      toast.error("Failed to create mailing labels. Please check your Google API configuration.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportFactSheets = async (clients: any[], listId?: string) => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-fact-sheets', {
        body: {
          clients,
          listId
        }
      });

      if (error) throw error;

      if (data?.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
        toast.success("Fact sheets created in Google Sheets");
      } else {
        throw new Error("No spreadsheet URL returned");
      }
    } catch (error) {
      console.error("Fact sheets export failed:", error);
      toast.error("Failed to create fact sheets. Please check your Google API configuration.");
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportEmailList,
    exportMailingLabels,
    exportFactSheets,
    isExporting
  };
}

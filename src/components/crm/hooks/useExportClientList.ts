import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateAddressLabelsHTML } from "@/lib/pdf/address-labels-template";
import { generatePDFViaPDFLayer } from "@/lib/pdf/pdf-utils";
export function useExportClientList() {
  const [isExporting, setIsExporting] = useState(false);

  const getListName = async (listId?: string) => {
    if (!listId) return 'all';
    
    try {
      const { data, error } = await supabase
        .from('client_lists')
        .select('name')
        .eq('id', listId)
        .single();
      
      if (error) throw error;
      return data?.name || listId;
    } catch (error) {
      console.error("Failed to fetch list name:", error);
      return listId;
    }
  };

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

      // Create filename with B_c-ListName_Date.csv format
      const date = new Date().toISOString().split('T')[0];
      const listName = await getListName(listId);
      const filename = `B_c-${listName}_${date}.csv`;

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
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
      // Filter clients with addresses
      const clientsWithAddress = clients.filter(client => 
        client.address || client.address_line1 || client.city
      );

      if (clientsWithAddress.length === 0) {
        toast.error("No clients with addresses to export");
        return;
      }

      // Generate HTML template for labels
      const html = generateAddressLabelsHTML(clientsWithAddress);
      
      // Generate PDF via PDFLayer
      const listName = await getListName(listId);
      const date = new Date().toISOString().split('T')[0];
      const fileName = `B_c-${listName}-labels_${date}.pdf`;
      
      const pdfBlob = await generatePDFViaPDFLayer({
        html,
        fileName,
        pageSize: 'a4',
        orientation: 'portrait'
      });

      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${clientsWithAddress.length} address labels to PDF`);
    } catch (error) {
      console.error("Mailing labels export failed:", error);
      toast.error("Failed to create mailing labels PDF");
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
        // Ensure the spreadsheet opens in a new tab
        const newWindow = window.open(data.spreadsheetUrl, '_blank', 'noopener,noreferrer');
        
        // Check if popup was blocked
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
          // Fallback: try to open without additional parameters
          window.open(data.spreadsheetUrl, '_blank');
        }
        
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

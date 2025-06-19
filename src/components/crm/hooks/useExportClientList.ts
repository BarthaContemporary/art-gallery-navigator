
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      const clientsWithAddress = clients.filter(client => client.address);
      
      if (clientsWithAddress.length === 0) {
        toast.error("No clients with addresses found to export");
        return;
      }

      // Generate Avery L7165 formatted content
      let labelContent = "MAILING LABELS - AVERY L7165 FORMAT\n";
      labelContent += "===================================\n\n";
      labelContent += "Instructions: Print on Avery L7165 label sheets (A4, 8 labels per sheet)\n";
      labelContent += "Each row below represents one label\n\n";

      // Process clients in groups of 8 (one sheet)
      for (let sheet = 0; sheet < Math.ceil(clientsWithAddress.length / 8); sheet++) {
        const sheetClients = clientsWithAddress.slice(sheet * 8, (sheet + 1) * 8);
        
        labelContent += `--- SHEET ${sheet + 1} ---\n\n`;
        
        // Process labels in pairs (left column, right column)
        for (let row = 0; row < 4; row++) {
          const leftIndex = row * 2;
          const rightIndex = row * 2 + 1;
          
          const leftClient = sheetClients[leftIndex];
          const rightClient = sheetClients[rightIndex];
          
          let rowContent = "";
          
          // Left column label
          if (leftClient) {
            rowContent += formatClientAddress(leftClient);
          }
          
          // Add spacing between columns
          rowContent += "\t\t\t|\t\t\t";
          
          // Right column label
          if (rightClient) {
            rowContent += formatClientAddress(rightClient);
          }
          
          labelContent += rowContent + "\n";
          labelContent += "---".repeat(20) + "\n";
        }
        
        labelContent += "\n\n";
      }

      // Create filename
      const date = new Date().toISOString().split('T')[0];
      const listName = await getListName(listId);
      const filename = `Mailing_Labels_${listName}_${date}.txt`;

      // Create and download file
      const blob = new Blob([labelContent], { type: "text/plain;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${clientsWithAddress.length} mailing labels`);
    } catch (error) {
      console.error("Mailing labels export failed:", error);
      toast.error("Failed to create mailing labels");
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

function formatClientAddress(client: any): string {
  let address = client.full_name;
  if (client.address) {
    // Split address by commas and add each part on a new line
    const addressParts = client.address.split(',').map((part: string) => part.trim());
    address += "\n" + addressParts.join("\n");
  }
  return address;
}

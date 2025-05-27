
import { toast } from "sonner";
import JSZip from 'jszip';
import { TABLES_FOR_CSV_EXPORT } from './constants';
import { fetchDataForTable } from './dataProvider';
import { formatCSVValue } from '@/lib/csv/csv-formatting'; // Use existing formatter

function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.map(formatCSVValue).join(',');
  const dataRows = data.map(row => {
    return headers.map(header => {
      return formatCSVValue(row[header]);
    }).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

export const exportDataAsCsvZip = async () => {
  toast.info("Starting data export as CSVs (Excel compatible)...");
  const zip = new JSZip();
  let sheetsAdded = 0;

  for (const tableName of TABLES_FOR_CSV_EXPORT) {
    const tableData = await fetchDataForTable(tableName);
    if (tableData && tableData.length > 0) {
      const headers = Object.keys(tableData[0]);
      const csvContent = convertToCSV(tableData, headers);
      zip.file(`${tableName}.csv`, csvContent);
      sheetsAdded++;
    } else if (tableData === null) {
      // Error already toasted by fetchDataForTable
    } else {
      toast.info(`No data found for ${tableName}, skipping CSV.`);
    }
  }
  
  if (sheetsAdded === 0) {
    toast.error("No data could be exported as CSV.");
    return;
  }

  zip.generateAsync({ type: 'blob' })
    .then((content) => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `data_export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${sheetsAdded} data sheets exported successfully in a ZIP.`);
    })
    .catch(err => {
      console.error("Error generating CSV zip file:", err);
      toast.error("Failed to generate ZIP file for CSVs.");
    });
};


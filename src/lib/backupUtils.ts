import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from 'jszip';
import type { Database } from '@/integrations/supabase/types'; // Import Database type

// Define a type for table names based on the Database schema
type TableName = keyof Database['public']['Tables'];

const TABLES_TO_EXPORT: TableName[] = [
  'artists', 'artworks', 'artwork_images', 'collections', 'collection_artworks',
  'collection_websites', 'documents', 'locations', 'projects', 'project_users',
  'project_tasks', 'project_task_references', 'clients', 'sales', 'exhibitions',
  'exhibition_artworks', 'profiles', 'user_roles', 'uploads'
  // 'deletion_requests' was causing an issue with the generated types, temporarily removed.
  // Needs to be verified if 'deletion_requests' table is fully defined in types.ts
  // For now, assuming it's not part of the core export or will be added back once types are confirmed.
];

async function fetchDataForTable(tableName: TableName) { // Use the TableName type
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    toast.error(`Failed to fetch data for ${tableName}.`);
    return null;
  }
  return data;
}

function formatCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const strValue = String(value);
  // Escape double quotes by doubling them, and wrap in double quotes if it contains comma, newline or double quote
  if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  return strValue;
}

function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.map(formatCSVValue).join(',');
  const dataRows = data.map(row => {
    return headers.map(header => {
      return formatCSVValue(row[header]);
    }).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}


export const exportDatabaseAsJson = async () => {
  toast.info("Starting database JSON export...");
  const backupData: Record<string, any> = {};
  let success = true;

  for (const tableName of TABLES_TO_EXPORT) {
    const tableData = await fetchDataForTable(tableName);
    if (tableData !== null) {
      backupData[tableName] = tableData;
    } else {
      success = false; // Mark as partially failed if any table fetch fails
    }
  }

  if (!success && Object.keys(backupData).length === 0) {
    toast.error("Database JSON export failed. No data could be fetched.");
    return;
  }
  if (!success) {
    toast.warning("Database JSON export partially completed. Some tables might be missing.");
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `database_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Database JSON export completed.");
};

export const exportAllMediaAsZip = async () => {
  toast.info("Starting media files export... This may take a while.");
  const zip = new JSZip();
  let filesAdded = 0;

  const sources = [
    { table: 'artwork_images' as TableName, urlColumn: 'image_url', fallbackName: 'artwork_image' },
    { table: 'artwork_images' as TableName, urlColumn: 'medium_url', fallbackName: 'artwork_medium_image' },
    { table: 'artwork_images' as TableName, urlColumn: 'thumbnail_url', fallbackName: 'artwork_thumbnail_image' },
    { table: 'documents' as TableName, urlColumn: 'file_url', nameColumn: 'file_name', fallbackName: 'document' },
    { table: 'uploads' as TableName, urlColumn: 'file_url', nameColumn: 'file_name', fallbackName: 'upload' },
    { table: 'artists' as TableName, urlColumn: 'image_url', fallbackName: 'artist_image' },
    { table: 'exhibitions' as TableName, urlColumn: 'image_url', fallbackName: 'exhibition_image' },
  ];

  for (const source of sources) {
    const selectColumns: string[] = [source.urlColumn, 'id'];
    if (source.nameColumn) {
      selectColumns.push(source.nameColumn);
    }

    const { data, error } = await supabase.from(source.table).select(selectColumns.join(','));
    
    if (error) {
      console.error(`Error fetching media from ${source.table}:`, error);
      toast.warning(`Could not fetch some media from ${source.table}.`);
      continue;
    }

    if (data) {
      for (const item of data as any[]) { // Cast item to any[] to bypass strict type checking for dynamic properties
        const url = item[source.urlColumn];
        if (url && typeof url === 'string') {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            const blob = await response.blob();
            
            let fileNamePart = source.nameColumn ? item[source.nameColumn] : null;
            if (!fileNamePart) {
              const extension = blob.type.split('/')[1] || 'file';
              fileNamePart = `${source.fallbackName}_${item.id}.${extension}`;
            }
            // Ensure unique file names within zip, prefix with table name
            const fileName = `${source.table}/${fileNamePart}`;

            zip.file(fileName, blob);
            filesAdded++;
          } catch (fetchError) {
            console.error(`Failed to download or add file ${url} to zip:`, fetchError);
            toast.warning(`Skipped file: ${url.substring(url.lastIndexOf('/') + 1)}`);
          }
        }
      }
    }
  }

  if (filesAdded === 0) {
    toast.error("No media files found or could be processed.");
    return;
  }

  zip.generateAsync({ type: 'blob' })
    .then((content) => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `media_backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${filesAdded} media files exported successfully.`);
    })
    .catch(err => {
      console.error("Error generating zip file:", err);
      toast.error("Failed to generate ZIP file for media.");
    });
};

export const exportDataAsCsvZip = async () => {
  toast.info("Starting data export as CSVs (Excel compatible)...");
  const zip = new JSZip();
  let sheetsAdded = 0;

  const tablesForCsvExport: TableName[] = [ // Use TableName type
    'artists', 'artworks', 'collections', 'documents', 'locations', 'projects', 'clients', 'sales', 'exhibitions', 'uploads'
  ];

  for (const tableName of tablesForCsvExport) {
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

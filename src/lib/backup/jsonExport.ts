
import { toast } from "sonner";
import { TABLES_TO_EXPORT } from './constants';
import { fetchDataForTable } from './dataProvider';

export const exportDatabaseAsJson = async (startDate?: string, endDate?: string) => {
  const isIncremental = startDate && endDate;
  toast.info(isIncremental ? `Starting incremental database JSON export for ${startDate} to ${endDate}...` : "Starting full database JSON export...");
  
  const backupData: Record<string, any> = {};
  let success = true;
  let tablesWithData = 0;

  for (const tableName of TABLES_TO_EXPORT) {
    const tableData = await fetchDataForTable(tableName, startDate, endDate);
    if (tableData !== null) {
      if (tableData.length > 0) {
        backupData[tableName] = tableData;
        tablesWithData++;
      } else if (isIncremental) {
        // If incremental and no data, it's fine, just don't add empty array to backupData
        // toast.info already handled by fetchDataForTable
      } else if (!isIncremental && tableData.length === 0) {
        // For full backup, if a table is empty, we can note it or include empty array.
        // Current behavior: don't add if empty.
        console.log(`Table ${tableName} is empty, not included in full backup.`);
      }
    } else {
      success = false; // Mark as partially failed if any table fetch fails
    }
  }

  if (!success && tablesWithData === 0) {
    toast.error(`Database JSON export failed. No data could be fetched${isIncremental ? ' for the selected range' : ''}.`);
    return;
  }
  if (tablesWithData === 0 && isIncremental) {
    toast.info("No data found for any table in the selected date range. Export not generated.");
    return;
  }
  if (!success) {
    toast.warning("Database JSON export partially completed. Some tables might be missing or incomplete.");
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateSuffix = new Date().toISOString().split('T')[0];
  const fileName = isIncremental 
    ? `db_backup_inc_${startDate}_to_${endDate}_${dateSuffix}.json`
    : `db_backup_full_${dateSuffix}.json`;
  link.download = fileName;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success(`Database JSON export completed successfully.${isIncremental && tablesWithData === 0 ? ' (No data in range)' : ''}`);
};

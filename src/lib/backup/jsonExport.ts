
import { toast } from "sonner";
import { TABLES_TO_EXPORT } from './constants';
import { fetchDataForTable } from './dataProvider';

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


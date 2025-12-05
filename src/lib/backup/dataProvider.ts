
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TableName } from './constants';

// Helper to get column type, not strictly needed for this change but good for context
// For this implementation, we'll rely on a predefined list of timestamp columns.
const timestampColumns: Partial<Record<TableName, { updated_at?: boolean, created_at?: boolean }>> = {
  'artists': { updated_at: true, created_at: true },
  'artworks': { updated_at: true, created_at: true },
  'artwork_images': { updated_at: true, created_at: true },
  'collections': { updated_at: true, created_at: true },
  'collection_websites': { updated_at: true, created_at: true },
  'documents': { updated_at: true, created_at: true },
  'locations': { updated_at: true, created_at: true },
  'projects': { updated_at: true, created_at: true },
  'project_tasks': { updated_at: true, created_at: true },
  'clients': { updated_at: true, created_at: true },
  'sales': { updated_at: true, created_at: true },
  'exhibitions': { updated_at: true, created_at: true },
  'profiles': { updated_at: true, created_at: true },
  'project_users': { created_at: true },
  'project_task_references': { created_at: true },
  'user_roles': { created_at: true },
  'uploads': { created_at: true },
  // 'collection_artworks', 'exhibition_artworks' have no direct timestamps for filtering by record update date
};

export async function fetchDataForTable(
  tableName: TableName,
  startDate?: string,
  endDate?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from(tableName) as any).select('*');

  const tableTimestampInfo = timestampColumns[tableName];
  let appliedDateFilter = false;

  if (startDate && endDate && tableTimestampInfo) {
    const filterColumn = tableTimestampInfo.updated_at ? 'updated_at' : (tableTimestampInfo.created_at ? 'created_at' : null);
    
    if (filterColumn) {
      // Ensure endDate includes the whole day
      const endOfDayEndDate = `${endDate}T23:59:59.999Z`;
      query = query.gte(filterColumn, startDate).lte(filterColumn, endOfDayEndDate);
      appliedDateFilter = true;
      console.log(`Applied date filter for ${tableName} on ${filterColumn} between ${startDate} and ${endOfDayEndDate}`);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    toast.error(`Failed to fetch data for ${tableName}.`);
    return null;
  }

  if (appliedDateFilter && data && data.length === 0) {
    toast.info(`No data found for ${tableName} within the selected date range.`);
  }
  
  return data;
}

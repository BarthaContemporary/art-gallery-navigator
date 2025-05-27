
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TableName } from './constants';

export async function fetchDataForTable(tableName: TableName) {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`Error fetching data for table ${tableName}:`, error);
    toast.error(`Failed to fetch data for ${tableName}.`);
    return null;
  }
  return data;
}



import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Location {
  id: string;
  name: string;
  type: string;
  address: string | null;
  notes: string | null;
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async (): Promise<Location[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, type, address, notes")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as Location[];
    },
  });
}

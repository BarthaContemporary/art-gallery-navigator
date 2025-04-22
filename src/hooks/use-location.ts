
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Location } from "./use-locations";

export function useLocation(locationId: string | null) {
  return useQuery({
    queryKey: ["location", locationId],
    queryFn: async (): Promise<Location | null> => {
      if (!locationId) return null;
      
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .single();

      if (error) {
        throw error;
      }

      return data as Location;
    },
    enabled: !!locationId,
  });
}

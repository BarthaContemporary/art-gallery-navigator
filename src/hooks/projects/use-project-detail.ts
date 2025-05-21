
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectWithLocation } from "./types"; // Updated import

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          location:locations(name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ProjectWithLocation;
    },
    enabled: !!id
  });
}


import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectWithLocation } from "./project-types";

export function useProjects(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          location:locations(name)
        `);
      
      if (filters?.status && filters.status !== "all") {
        query = query.eq('status', filters.status as 'active' | 'scheduled' | 'completed' | 'abandoned');
      }
      
      if (filters?.type && filters.type !== "all") {
        query = query.eq('type', filters.type as 'exhibition' | 'fair' | 'publication' | 'talk' | 'other');
      }
      
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      
      const { data, error } = await query.order('start_date', { ascending: true });
      
      if (error) throw error;
      return data as ProjectWithLocation[];
    },
    enabled: !!user
  });
}

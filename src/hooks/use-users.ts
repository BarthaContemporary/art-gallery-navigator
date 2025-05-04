
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email_confirmed: boolean;
}

export function useUsers(search?: string) {
  return useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*');
      
      if (search) {
        query = query.ilike('display_name', `%${search}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as User[];
    }
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (error) throw error;
      
      // Create a map of user_id to roles
      const userRoles: Record<string, string[]> = {};
      
      data.forEach(item => {
        if (!userRoles[item.user_id]) {
          userRoles[item.user_id] = [];
        }
        userRoles[item.user_id].push(item.role);
      });
      
      return userRoles;
    }
  });
}

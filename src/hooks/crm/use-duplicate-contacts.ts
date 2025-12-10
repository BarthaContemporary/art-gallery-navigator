import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicateGroup {
  email: string;
  duplicate_count: number;
  contact_ids: string[];
  contact_names: string[];
  contact_phones: (string | null)[];
  contact_types: string[];
  created_dates: string[];
}

export function useDuplicateContacts() {
  return useQuery({
    queryKey: ["crm-duplicate-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_duplicate_contacts" as any);
      
      if (error) throw error;
      return (data || []) as DuplicateGroup[];
    },
  });
}

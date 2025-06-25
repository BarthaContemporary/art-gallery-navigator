
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEnhancedDocuments(folderId?: string | null) {
  return useQuery({
    queryKey: ["enhanced-documents", folderId],
    queryFn: async () => {
      console.log("Enhanced documents query - folderId:", folderId);
      
      let query = supabase
        .from("documents")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      // Fix the UUID null issue by using proper null checking
      if (folderId === null || folderId === undefined) {
        query = query.is("folder_id", null);
      } else {
        query = query.eq("folder_id", folderId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Enhanced documents query error:", error);
        throw error;
      }

      console.log("Enhanced documents query result:", data);
      return data || [];
    },
  });
}

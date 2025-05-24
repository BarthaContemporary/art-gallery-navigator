
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Delete a collection website
export function useDeleteCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { id: string; collection_id: string }>({
    mutationFn: async ({ id, collection_id }: { id: string; collection_id: string }): Promise<void> => {
      const { error } = await supabase
        .from("collection_websites")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", variables.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}


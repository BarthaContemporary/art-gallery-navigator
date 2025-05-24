
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Delete a collection website
export function useDeleteCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { id: string; collection_id: string }>({
    mutationFn: async ({ id }: { id: string; collection_id: string }): Promise<void> => { // collection_id is used in onSuccess, so keep it in params
      const { error } = await supabase
        .from("collection_websites")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", variables.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] }); // Related to individual collection views
      queryClient.invalidateQueries({ queryKey: ["allCollectionWebsites"] }); // For the manage all websites page
      // Also, if a public view was cached by slug, it might be good to remove it, though less critical.
      // This would require knowing the slug, which isn't directly part of `variables` here.
      // For now, invalidating the main lists should be sufficient.
    },
    // meta: { onError: ... } // if you have global error handling configured
  });
}

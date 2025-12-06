
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hashPasswordWithEdgeFunction } from "@/utils/collectionWebsitePasswordUtils";
import type { CollectionWebsiteAdmin, UpdateCollectionWebsitePayload } from "@/types/collection-website";

// Update an existing collection website (admin only)
export function useUpdateCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation<CollectionWebsiteAdmin, Error, UpdateCollectionWebsitePayload>({
    mutationFn: async ({
      id,
      collection_id,
      name,
      password, 
      show_prices,
      is_active,
    }: UpdateCollectionWebsitePayload): Promise<CollectionWebsiteAdmin> => {
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (show_prices !== undefined) updateData.show_prices = show_prices;
      if (is_active !== undefined) updateData.is_active = is_active;

      if (password !== undefined) {
        if (password && password.trim().length > 0) {
          updateData.password_hash = await hashPasswordWithEdgeFunction(password, "update");
        } else {
          updateData.password_hash = null;
          console.log("Password set to null (removed) for update.");
        }
      }

      const { data, error } = await supabase
        .from("collection_websites")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) {
        console.error("Supabase update error:", error);
        throw error || new Error("Failed to update collection website");
      }
      console.log("Collection website updated:", data.id);
      return data as CollectionWebsiteAdmin;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", data.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["publicCollectionWebsite", data.slug] });
      queryClient.invalidateQueries({ queryKey: ["allCollectionWebsites"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}


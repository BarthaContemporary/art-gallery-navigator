
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug } from "@/utils/slugUtils";
import { hashPasswordWithEdgeFunction } from "@/utils/collectionWebsitePasswordUtils";
import type { CollectionWebsiteAdmin, CreateCollectionWebsitePayload } from "@/types/collection-website";

// Create a new collection website (admin only)
export function useCreateCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation<CollectionWebsiteAdmin, Error, CreateCollectionWebsitePayload>({
    mutationFn: async ({
      collection_id,
      collection_name,
      name,
      password,
      show_prices = true,
      is_active = true,
    }: CreateCollectionWebsitePayload): Promise<CollectionWebsiteAdmin> => {
      const slug = generateSlug(collection_name || name || "collection-website");
      let password_hash: string | null = null;

      if (password && password.trim().length > 0) {
        password_hash = await hashPasswordWithEdgeFunction(password, "create");
      } else {
        console.log("No password provided or password is empty for create, setting hash to null.");
      }

      const { data, error } = await supabase
        .from("collection_websites")
        .insert({
          collection_id,
          name,
          slug,
          password_hash,
          show_prices,
          is_active,
        })
        .select("*")
        .single();

      if (error || !data) {
        console.error("Supabase insert error:", error);
        throw error || new Error("Failed to create collection website");
      }
      console.log("Collection website created:", data.id);
      return data as CollectionWebsiteAdmin;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", data.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["allCollectionWebsites"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}


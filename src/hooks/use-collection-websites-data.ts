import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug } from "@/utils/slugUtils"; // Import from new location
import { hashPasswordWithEdgeFunction } from "@/utils/collectionWebsitePasswordUtils"; // Import new utility

// Interface for Collection Websites
export interface CollectionWebsite {
  id: string;
  collection_id: string;
  name?: string | null;
  slug: string;
  password_hash?: string | null; // Will store hashed password
  show_prices: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Fetch all websites for a specific collection
export function useCollectionWebsites(collectionId: string | undefined) {
  return useQuery({
    queryKey: ["collectionWebsites", collectionId],
    queryFn: async (): Promise<CollectionWebsite[]> => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_websites")
        .select("*")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!collectionId, // Only run query if collectionId is provided
  });
}

// Fetch a single public collection website by slug
export function usePublicCollectionWebsite(slug: string | undefined) {
  return useQuery({
    queryKey: ["publicCollectionWebsite", slug],
    queryFn: async (): Promise<CollectionWebsite | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("collection_websites")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true) // Only fetch active websites
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: "Searched item was not found" - not an error for .single() if item might not exist
        throw error;
      }
      return data;
    },
    enabled: !!slug,
  });
}

// Create a new collection website
export interface CreateCollectionWebsitePayload {
  collection_id: string;
  collection_name?: string; // Used for slug generation
  name?: string;
  password?: string; // Plain text password, will be hashed by Edge Function
  show_prices?: boolean;
  is_active?: boolean;
}

export function useCreateCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      collection_id,
      collection_name,
      name,
      password,
      show_prices = true,
      is_active = true,
    }: CreateCollectionWebsitePayload): Promise<CollectionWebsite> => {
      const slug = generateSlug(collection_name || name || "collection-website"); // Use collection_name or name for slug
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
          password_hash, // Store hashed password or null
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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", data.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// Update an existing collection website
export interface UpdateCollectionWebsitePayload {
  id: string;
  collection_id: string; // Needed for invalidation
  name?: string;
  password?: string | null; // Plain text or null to remove. Undefined to not change.
  show_prices?: boolean;
  is_active?: boolean;
}

export function useUpdateCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      collection_id, // used for invalidation key
      name,
      password, 
      show_prices,
      is_active,
    }: UpdateCollectionWebsitePayload): Promise<CollectionWebsite> => {
      
      const updateData: Partial<Omit<CollectionWebsite, 'id' | 'collection_id' | 'created_at' | 'slug'>> & { updated_at: string } = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (show_prices !== undefined) updateData.show_prices = show_prices;
      if (is_active !== undefined) updateData.is_active = is_active;

      // Handle password update
      if (password !== undefined) { // if password field is part of the payload
        if (password && password.trim().length > 0) { // New password string provided
          updateData.password_hash = await hashPasswordWithEdgeFunction(password, "update");
        } else { // Password is null or empty string, so remove it
          updateData.password_hash = null;
          console.log("Password set to null (removed) for update.");
        }
      }
      // If password is undefined, password_hash is not included in updateData, so it's not changed.

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
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", data.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["publicCollectionWebsite", data.slug]});
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// Delete a collection website
export function useDeleteCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation({
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

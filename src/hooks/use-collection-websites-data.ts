import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Interface for Collection Websites
export interface CollectionWebsite {
  id: string;
  collection_id: string;
  name?: string | null;
  slug: string;
  password_hash?: string | null; // TEMPORARY: Will store plain password. MUST be replaced by secure hashing via Edge Function.
  show_prices: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Helper function to generate a robust slug
const generateSlug = (name: string = "collection"): string => {
  const cleanedName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  const timestamp = Date.now().toString(36); // Base36 timestamp

  // Generate a longer random part by combining two Math.random() outputs
  // Math.random().toString(36) is '0.' + ~11-12 base36 chars. We take substring(2).
  const randomPart1 = Math.random().toString(36).substring(2, 10); // 8 chars
  const randomPart2 = Math.random().toString(36).substring(2, 10); // 8 chars
  // Ensure consistent length for the random string part, e.g., 12 characters
  const randomString = `${randomPart1}${randomPart2}`.slice(0, 12);

  const base = cleanedName || 'website';
  
  // Truncate base name if it's too long to keep overall slug length reasonable
  const maxBaseNameLength = 50; // Max length for the name part of the slug
  const truncatedBase = base.length > maxBaseNameLength ? base.substring(0, maxBaseNameLength) : base;

  return `${truncatedBase}-${timestamp}-${randomString}`;
};

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
  password?: string; // TEMPORARY: Plain text. MUST be hashed via Edge Function.
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
      const slug = generateSlug(collection_name || "collection"); // Generate a unique slug

      // TEMPORARY: Storing password directly. MUST implement Edge Function for hashing.
      const password_hash = password || null;

      const { data, error } = await supabase
        .from("collection_websites")
        .insert({
          collection_id,
          name,
          slug,
          password_hash, // Storing plain text or null
          show_prices,
          is_active,
        })
        .select("*")
        .single();

      if (error || !data) throw error || new Error("Failed to create collection website");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collectionWebsites", data.collection_id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] }); // If counts/derived data changes
    },
  });
}

// Update an existing collection website
export interface UpdateCollectionWebsitePayload {
  id: string;
  collection_id: string; // Needed for invalidation
  name?: string;
  password?: string | null; // TEMPORARY: Plain text or null to remove. MUST be hashed.
  show_prices?: boolean;
  is_active?: boolean;
  // slug is generally not updated to avoid breaking links.
}

export function useUpdateCollectionWebsite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      collection_id,
      name,
      password, // If undefined, password_hash is not changed. If null, it's cleared. If string, it's updated.
      show_prices,
      is_active,
    }: UpdateCollectionWebsitePayload): Promise<CollectionWebsite> => {
      
      const updateData: Partial<CollectionWebsite> = {};
      if (name !== undefined) updateData.name = name;
      // TEMPORARY: Handling password directly. MUST implement Edge Function for hashing.
      if (password !== undefined) updateData.password_hash = password; // password can be null to remove it
      if (show_prices !== undefined) updateData.show_prices = show_prices;
      if (is_active !== undefined) updateData.is_active = is_active;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("collection_websites")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) throw error || new Error("Failed to update collection website");
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
      // Optionally, invalidate public view if slug was known, but usually deletion makes it inaccessible
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

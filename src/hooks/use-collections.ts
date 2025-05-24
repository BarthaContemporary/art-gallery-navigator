import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Artwork } from "@/hooks/use-artworks";

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  artworks?: Artwork[];
  external_emails?: string[];
}

// New interface for Collection Websites
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

// Fetch all collections with attached artworks
export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async (): Promise<Collection[]> => {
      const { data, error } = await supabase
        .from("collections")
        .select("*, collection_artworks(artwork_id, artworks(*))")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform the data structure to get artworks from collection_artworks
      return data?.map((collection: any) => ({
        ...collection,
        artworks: collection.collection_artworks?.map((ca: any) => ca.artworks).filter(Boolean) || [],
      })) || [];
    },
  });
}

// Create a new collection (optionally attaching artworks)
export function useCreateCollection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      name,
      description,
      artworkIds,
      externalEmails,
    }: {
      name: string;
      description?: string;
      artworkIds?: string[];
      externalEmails?: string[];
    }) => {
      // 1. Create collection with external emails
      const { data: colData, error } = await supabase
        .from("collections")
        .insert({ 
          name, 
          description,
          external_emails: externalEmails 
        })
        .select("*")
        .single();

      if (error || !colData) throw error;

      // 2. Link artworks if provided
      if (artworkIds && artworkIds.length > 0) {
        const { error: linkErr } = await supabase.from("collection_artworks").insert(
          artworkIds.map((artwork_id) => ({
            collection_id: colData.id,
            artwork_id,
          }))
        );
        if (linkErr) throw linkErr;
      }
      return colData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// Update collection mutation
export function useUpdateCollection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      name, 
      description,
      artworkIds,
      externalEmails
    }: { 
      id: string; 
      name: string; 
      description?: string;
      artworkIds?: string[];
      externalEmails?: string[];
    }) => {
      // 1. Update collection details
      const { data: colData, error } = await supabase
        .from("collections")
        .update({ 
          name, 
          description,
          external_emails: externalEmails 
        })
        .eq("id", id)
        .select()
        .single();
        
      if (error) throw error;

      // 2. If artworkIds provided, update collection_artworks
      if (artworkIds !== undefined) {
        // First delete existing artwork links
        const { error: deleteError } = await supabase
          .from("collection_artworks")
          .delete()
          .eq("collection_id", id);
          
        if (deleteError) throw deleteError;

        // Then insert new artwork links if there are any
        if (artworkIds.length > 0) {
          const { error: insertError } = await supabase
            .from("collection_artworks")
            .insert(
              artworkIds.map(artwork_id => ({
                collection_id: id,
                artwork_id,
              }))
            );
            
          if (insertError) throw insertError;
        }
      }

      return colData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// Delete collection mutation
export function useDeleteCollection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First delete the collection_artworks entries
      const { error: linkError } = await supabase
        .from("collection_artworks")
        .delete()
        .eq("collection_id", id);
        
      if (linkError) throw linkError;
      
      // Then delete the collection, but do NOT delete any documents
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
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

// Helper function to generate a simple slug (replace with a more robust solution if needed)
const generateSlug = (name: string = "collection"): string => {
  const randomString = Math.random().toString(36).substring(2, 9);
  const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${baseSlug || 'website'}-${randomString}`;
};

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

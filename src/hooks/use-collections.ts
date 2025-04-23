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
    }: {
      name: string;
      description?: string;
      artworkIds?: string[];
    }) => {
      // 1. Create collection
      const { data: colData, error } = await supabase
        .from("collections")
        .insert({ name, description })
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
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("collections")
        .update({ name, description })
        .eq("id", id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
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
      
      // Then delete the collection
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

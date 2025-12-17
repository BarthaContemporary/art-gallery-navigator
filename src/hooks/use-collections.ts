
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";
import { Artwork } from "@/hooks/use-artworks";

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  artworks?: Artwork[];
  external_emails?: string[];
  artist_name?: string; // For displaying artist name in admin view
}

// Fetch all collections with attached artworks
export function useCollections() {
  const { isAdmin, isArtist } = useAuth();
  const currentUserArtist = useCurrentUserArtist();
  
  return useQuery({
    queryKey: ["collections", isArtist, currentUserArtist?.id],
    queryFn: async (): Promise<Collection[]> => {
      // Step 1: Fetch collections (simple query)
      const { data: collections, error: collectionsError } = await supabase
        .from("collections")
        .select("id, name, description, created_at, updated_at, external_emails")
        .order("created_at", { ascending: false });

      if (collectionsError) throw collectionsError;
      if (!collections || collections.length === 0) return [];

      // Step 2: Fetch collection_artworks separately
      const collectionIds = collections.map(c => c.id);
      const { data: collectionArtworks, error: caError } = await supabase
        .from("collection_artworks")
        .select("collection_id, artwork_id")
        .in("collection_id", collectionIds);

      if (caError) throw caError;

      // Step 3: Fetch artworks using the public safe view
      const artworkIds = [...new Set(collectionArtworks?.map(ca => ca.artwork_id) || [])];
      let artworksMap: Map<string, any> = new Map();
      
      if (artworkIds.length > 0) {
        const { data: artworks, error: artworksError } = await supabase
          .from("artworks_public_safe")
          .select("*")
          .in("id", artworkIds);

        if (artworksError) throw artworksError;
        artworks?.forEach(a => artworksMap.set(a.id, a));
      }

      // Step 4: Build collection objects with artworks
      const result = collections.map(collection => {
        const artworkIdsForCollection = collectionArtworks
          ?.filter(ca => ca.collection_id === collection.id)
          .map(ca => ca.artwork_id) || [];
        
        const artworks = artworkIdsForCollection
          .map(id => artworksMap.get(id))
          .filter(Boolean);

        // For artist filtering
        if (isArtist && currentUserArtist?.id) {
          const hasArtistArtwork = artworks.some((a: any) => a.artist_id === currentUserArtist.id);
          if (!hasArtistArtwork) return null;
        }

        return {
          ...collection,
          artworks,
          artist_name: isAdmin && artworks.length > 0 ? artworks[0]?.artist_name : undefined,
        };
      }).filter(Boolean) as Collection[];

      return result;
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
      // Document deletion associated with a collection is handled in CollectionCard.tsx's confirmDelete
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


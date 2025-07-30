
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
      if (isArtist && currentUserArtist?.id) {
        // For artists, get collections that contain their artworks
        const { data: artistCollections, error } = await supabase
          .from("collections")
          .select(`
            *, 
            collection_artworks!inner(
              artwork_id, 
              artworks!inner(
                *, 
                artists(full_name)
              )
            )
          `)
          .eq('collection_artworks.artworks.artist_id', currentUserArtist.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform the data and remove duplicates
        const collectionsMap = new Map();
        artistCollections?.forEach((collection: any) => {
          if (!collectionsMap.has(collection.id)) {
            const artworks = collection.collection_artworks?.map((ca: any) => ca.artworks).filter(Boolean) || [];
            collectionsMap.set(collection.id, {
              ...collection,
              artworks,
            });
          }
        });

        return Array.from(collectionsMap.values());
      } else {
        // For admins, get all collections
        const { data, error } = await supabase
          .from("collections")
          .select(`
            *, 
            collection_artworks(
              artwork_id, 
              artworks(
                *, 
                artists(full_name)
              )
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform the data structure to get artworks from collection_artworks
        const collections = data?.map((collection: any) => {
          const artworks = collection.collection_artworks?.map((ca: any) => ca.artworks).filter(Boolean) || [];
          
          // For admin view, get artist name from first artwork
          let artist_name = undefined;
          if (isAdmin && artworks.length > 0) {
            const firstArtist = artworks[0]?.artists?.full_name;
            if (firstArtist) {
              artist_name = firstArtist;
            }
          }
          
          return {
            ...collection,
            artworks,
            artist_name,
          };
        }) || [];

        return collections;
      }
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


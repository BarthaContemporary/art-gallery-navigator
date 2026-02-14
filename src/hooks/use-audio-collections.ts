import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AudioTrack } from "./use-audio-tracks";

export interface AudioCollection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioCollectionItem {
  id: string;
  collection_id: string;
  track_id: string;
  position: number;
  audio_tracks?: AudioTrack;
}

export function useAudioCollections() {
  return useQuery({
    queryKey: ["audio-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_collections" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AudioCollection[];
    },
  });
}

export function useAudioCollectionBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["audio-collection", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_collections" as any)
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AudioCollection | null;
    },
  });
}

export function useAudioCollectionItems(collectionId: string | undefined) {
  return useQuery({
    queryKey: ["audio-collection-items", collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_collection_items" as any)
        .select("*, audio_tracks(*)")
        .eq("collection_id", collectionId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AudioCollectionItem[];
    },
  });
}

export function useCreateAudioCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (col: Partial<AudioCollection>) => {
      const { data, error } = await supabase
        .from("audio_collections" as any)
        .insert(col as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AudioCollection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-collections"] }),
  });
}

export function useDeleteAudioCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audio_collections" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-collections"] }),
  });
}

export function useAddTrackToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ collection_id, track_id, position }: { collection_id: string; track_id: string; position: number }) => {
      const { error } = await supabase
        .from("audio_collection_items" as any)
        .insert({ collection_id, track_id, position } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-collection-items"] }),
  });
}

export function useRemoveTrackFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audio_collection_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-collection-items"] }),
  });
}

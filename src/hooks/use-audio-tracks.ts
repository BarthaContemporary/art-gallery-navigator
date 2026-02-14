import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AudioTrack {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  series: string | null;
  description: string | null;
  tags: string[] | null;
  duration_seconds: number | null;
  date_published: string | null;
  cover_image_url: string | null;
  storage_key: string | null;
  visibility: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAudioTracks(filters?: { search?: string; tags?: string[]; sort?: string }) {
  return useQuery({
    queryKey: ["audio-tracks", filters],
    queryFn: async () => {
      let q = supabase.from("audio_tracks" as any).select("*");
      if (filters?.search) {
        q = q.or(`title.ilike.%${filters.search}%,artist.ilike.%${filters.search}%,series.ilike.%${filters.search}%`);
      }
      if (filters?.tags?.length) {
        q = q.overlaps("tags", filters.tags);
      }
      if (filters?.sort === "oldest") {
        q = q.order("date_published", { ascending: true, nullsFirst: false });
      } else if (filters?.sort === "title") {
        q = q.order("title", { ascending: true });
      } else {
        q = q.order("created_at", { ascending: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as AudioTrack[];
    },
  });
}

export function useAudioTrackBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["audio-track", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_tracks" as any)
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AudioTrack | null;
    },
  });
}

export function useCreateAudioTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (track: Partial<AudioTrack>) => {
      const { data, error } = await supabase
        .from("audio_tracks" as any)
        .insert(track as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AudioTrack;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-tracks"] }),
  });
}

export function useUpdateAudioTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AudioTrack> & { id: string }) => {
      const { data, error } = await supabase
        .from("audio_tracks" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AudioTrack;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-tracks"] }),
  });
}

export function useDeleteAudioTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audio_tracks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audio-tracks"] }),
  });
}

export function getAudioPublicUrl(storageKey: string) {
  const { data } = supabase.storage.from("audio").getPublicUrl(storageKey);
  return data.publicUrl;
}

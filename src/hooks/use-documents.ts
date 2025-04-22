
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  file_name: string;
  file_url: string;
  type: string;
  description: string | null;
  artwork_id: string | null;
  artist_id: string | null;
  date_uploaded: string;
}

export function useDocuments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<Document[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("date_uploaded", { ascending: false });

      if (error) {
        throw error;
      }
      return data;
    },
  });

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase.channel("documents-liveview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}


import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      try {
        console.log("Fetching documents...");
        
        // Check if bucket exists
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          console.error("Error fetching storage buckets:", bucketError);
        } else {
          console.log("Available buckets:", buckets);
          const documentsBucket = buckets.find(b => b.name === 'documents');
          if (!documentsBucket) {
            console.warn("Documents bucket not found in storage!");
          }
        }
        
        // First fetch documents from the database table
        const { data: dbData, error: dbError } = await supabase
          .from("documents")
          .select("*")
          .order("date_uploaded", { ascending: false });

        if (dbError) {
          console.error("Error fetching documents from database:", dbError);
          throw dbError;
        }
        
        // Check if we have actual data
        console.log("Documents fetched:", dbData);
        return dbData || [];
      } catch (error) {
        console.error("Failed to fetch documents:", error);
        toast.error("Failed to load documents: " + (error as Error).message);
        return [];
      }
    },
  });

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          console.log("Documents changed, invalidating query cache");
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

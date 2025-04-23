
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./use-auth";

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
  const { user, session } = useAuth();

  const query = useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<Document[]> => {
      try {
        console.log("Fetching documents...");
        
        // Check if user is authenticated
        if (!session || !user) {
          console.warn("User not authenticated, cannot fetch documents");
          // Using warn instead of error to avoid showing error toast on initial load
          return [];
        }
        
        // Check if bucket exists
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          console.error("Error fetching storage buckets:", bucketError);
          toast.error("Error accessing document storage");
          throw bucketError;
        } else {
          console.log("Available buckets:", buckets.map(b => b.name).join(", "));
          const documentsBucket = buckets.find(b => b.name === 'documents');
          if (!documentsBucket) {
            console.warn("Documents bucket not found in storage! Available buckets:", 
              buckets.map(b => b.name).join(", "));
            toast.error("Document storage not configured properly");
            return [];
          }
          console.log("Documents bucket found with ID:", documentsBucket.id);
        }
        
        // Fetch documents from the database table
        console.log("Fetching documents from database...");
        const { data: dbData, error: dbError } = await supabase
          .from("documents")
          .select("*")
          .order("date_uploaded", { ascending: false });

        if (dbError) {
          console.error("Error fetching documents from database:", dbError);
          toast.error("Failed to load documents");
          throw dbError;
        }
        
        // Check if we have actual data
        console.log(`Documents fetched: ${dbData?.length || 0} records found`);
        return dbData || [];
      } catch (error) {
        console.error("Failed to fetch documents:", error);
        toast.error("Failed to load documents: " + (error as Error).message);
        return [];
      }
    },
    enabled: !!session, // Only run query when user is authenticated
  });

  // Real-time subscription for live updates
  useEffect(() => {
    if (!session) return;
    
    console.log("Setting up real-time subscription for documents table");
    const channel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          console.log("Documents changed, received payload:", payload);
          console.log("Invalidating documents query cache");
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }
      )
      .subscribe((status) => {
        console.log("Documents subscription status:", status);
      });

    return () => {
      console.log("Cleaning up documents subscription");
      supabase.removeChannel(channel);
    };
  }, [queryClient, session]);

  return query;
}

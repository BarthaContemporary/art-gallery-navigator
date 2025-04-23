
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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

// Function to ensure the documents bucket exists
export async function ensureDocumentsBucketExists(): Promise<boolean> {
  try {
    console.log("Checking if documents bucket exists...");
    
    // First check if bucket already exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error checking buckets:", bucketsError);
      return false;
    }
    
    const documentsBucket = buckets.find(bucket => bucket.name === 'documents');
    
    if (documentsBucket) {
      console.log("Documents bucket already exists with ID:", documentsBucket.id);
      return true;
    }
    
    // If we reach here, the bucket doesn't exist
    console.log("Documents bucket not found, attempting to create it...");
    
    try {
      // Try to create the bucket
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('documents', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (createError) {
        console.error("Failed to create documents bucket:", createError);
        
        // Since we can't create the bucket, let's check if it exists anyway after running the SQL
        const { data: recheckedBuckets } = await supabase.storage.listBuckets();
        const existingBucket = recheckedBuckets?.find(bucket => bucket.name === 'documents');
        
        if (existingBucket) {
          console.log("Found existing documents bucket on recheck:", existingBucket.id);
          return true;
        }
        
        // Only show error if we can't find the bucket at all
        if (!existingBucket) {
          toast.error("Document storage configuration issue. Please refresh and try again.", {
            duration: 5000
          });
        }
        
        return !!existingBucket;
      }
      
      console.log("Successfully created documents bucket:", newBucket);
      return true;
    } catch (createError) {
      console.error("Exception during bucket creation:", createError);
      return false;
    }
  } catch (error) {
    console.error("Error ensuring documents bucket exists:", error);
    return false;
  }
}

export function useDocuments() {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();

  // Query to ensure bucket exists
  const bucketQuery = useQuery({
    queryKey: ["documents-bucket"],
    queryFn: ensureDocumentsBucketExists,
    enabled: !!session, // Only run when authenticated
    retry: 2,
    staleTime: 1000 * 60 * 60, // Cache for an hour
  });

  // Add a mutation to force bucket creation/verification
  const verifyBucketMutation = useMutation({
    mutationFn: ensureDocumentsBucketExists,
    onSuccess: (success) => {
      if (success) {
        toast.success("Document storage configured successfully");
        // Refresh documents list
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } else {
        toast.error("Failed to verify document storage status");
      }
    },
  });
  
  // Main query for documents
  const documentsQuery = useQuery({
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
        
        // We'll proceed with fetching documents even if bucket verification failed
        // This allows viewing existing documents even if there are storage issues
        
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

  return {
    ...documentsQuery,
    bucketStatus: bucketQuery.status,
    isBucketLoading: bucketQuery.isLoading,
    bucketError: bucketQuery.error,
    bucketData: bucketQuery.data,
    verifyBucket: () => verifyBucketMutation.mutate(),
    isVerifying: verifyBucketMutation.isPending,
  };
}

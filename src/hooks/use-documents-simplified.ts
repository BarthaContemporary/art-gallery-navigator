
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  collection_id: string | null;
  date_uploaded: string;
}

export function useDocumentsSimplified() {
  const { user, session } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});

  // Debug logging for authentication state
  useEffect(() => {
    const authDebug = {
      hasUser: !!user,
      hasSession: !!session,
      userId: user?.id,
      userEmail: user?.email,
      sessionExpiresAt: session?.expires_at
    };
    console.log("Documents hook - Auth state:", authDebug);
    setDebugInfo(prev => ({ ...prev, auth: authDebug }));
  }, [user, session]);

  // Main query for documents
  const documentsQuery = useQuery({
    queryKey: ["documents-simplified"],
    queryFn: async (): Promise<Document[]> => {
      console.log("🚀 Starting documents fetch...");
      
      try {
        // Check authentication first
        if (!session || !user) {
          console.warn("❌ No authentication - user or session missing");
          console.log("Session exists:", !!session);
          console.log("User exists:", !!user);
          return [];
        }

        console.log("✅ Authentication verified for user:", user.email);

        // Simple database query without complex bucket logic
        console.log("📊 Fetching documents from database...");
        const { data: dbData, error: dbError } = await supabase
          .from("documents")
          .select("*")
          .order("date_uploaded", { ascending: false });

        if (dbError) {
          console.error("❌ Database error:", dbError);
          console.error("Error details:", {
            message: dbError.message,
            details: dbError.details,
            hint: dbError.hint,
            code: dbError.code
          });
          
          // Show user-friendly error
          toast.error(`Database error: ${dbError.message}`);
          throw new Error(`Database error: ${dbError.message}`);
        }

        console.log(`✅ Documents fetched successfully: ${dbData?.length || 0} records`);
        console.log("Sample documents:", dbData?.slice(0, 2));

        setDebugInfo(prev => ({ 
          ...prev, 
          query: { 
            success: true, 
            count: dbData?.length || 0,
            timestamp: new Date().toISOString()
          }
        }));

        return dbData || [];

      } catch (error) {
        console.error("💥 Exception in documents fetch:", error);
        
        const errorInfo = {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack
        };
        
        console.error("Error details:", errorInfo);
        setDebugInfo(prev => ({ ...prev, error: errorInfo }));
        
        // Don't show toast for auth-related issues to avoid spam
        if (session && user) {
          toast.error("Failed to load documents. Please try refreshing the page.");
        }
        
        throw error;
      }
    },
    enabled: !!session && !!user, // Only run when authenticated
    retry: (failureCount, error) => {
      console.log(`Query retry attempt ${failureCount}:`, error);
      return failureCount < 2; // Retry max 2 times
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Real-time subscription with error handling
  useEffect(() => {
    if (!session || !user) {
      console.log("⏭️ Skipping real-time setup - no authentication");
      return;
    }
    
    console.log("🔄 Setting up real-time subscription for documents");
    
    const channel = supabase
      .channel("documents-changes-simplified")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          console.log("🔄 Real-time documents change:", payload);
          documentsQuery.refetch();
        }
      )
      .subscribe((status) => {
        console.log("📡 Real-time subscription status:", status);
      });

    return () => {
      console.log("🧹 Cleaning up documents real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [session, user]);

  return {
    ...documentsQuery,
    debugInfo, // Expose debug info for troubleshooting
  };
}

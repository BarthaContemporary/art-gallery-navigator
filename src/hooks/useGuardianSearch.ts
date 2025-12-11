import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GuardianArticle {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  shortUrl?: string;
  byline?: string;
  sectionName?: string;
  publishedDate?: string;
}

interface GuardianSearchResult {
  success: boolean;
  articles?: GuardianArticle[];
  total?: number;
  error?: string;
}

export function useGuardianSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<GuardianArticle[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchArtist = useCallback(async (artistName: string) => {
    if (!artistName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke<GuardianSearchResult>(
        "guardian-search",
        { body: { artistName } }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data.articles) {
        setArticles(data.articles);
      } else {
        setError(data?.error || "Failed to fetch articles");
        setArticles([]);
      }
    } catch (err) {
      console.error("Guardian search error:", err);
      setError(err instanceof Error ? err.message : "Failed to search");
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { searchArtist, articles, isLoading, error };
}

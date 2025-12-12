import { useState, useCallback, useRef } from "react";
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

// Simple cache to prevent duplicate requests
const cache = new Map<string, { articles: GuardianArticle[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useGuardianSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<GuardianArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastRequestRef = useRef<string | null>(null);

  const searchArtist = useCallback(async (artistName: string) => {
    if (!artistName) return;
    
    // Prevent duplicate requests for same artist
    if (lastRequestRef.current === artistName) return;
    lastRequestRef.current = artistName;
    
    // Check cache first
    const cached = cache.get(artistName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setArticles(cached.articles);
      setError(null);
      return;
    }
    
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
        cache.set(artistName, { articles: data.articles, timestamp: Date.now() });
      } else if (data?.error?.includes("429")) {
        // Rate limited - use cached data if available, even if stale
        if (cached) {
          setArticles(cached.articles);
          setError("Rate limited - showing cached results");
        } else {
          setError("Rate limited - please try again later");
          setArticles([]);
        }
      } else {
        setError(data?.error || "Failed to fetch articles");
        setArticles([]);
      }
    } catch (err) {
      console.error("Guardian search error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to search";
      if (errorMsg.includes("429") && cached) {
        setArticles(cached.articles);
        setError("Rate limited - showing cached results");
      } else {
        setError(errorMsg);
        setArticles([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { searchArtist, articles, isLoading, error };
}

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NewsAPIArticle {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  sourceName?: string;
  author?: string;
  publishedDate?: string;
}

interface NewsAPISearchResult {
  success: boolean;
  articles?: NewsAPIArticle[];
  total?: number;
  error?: string;
}

// Simple cache to prevent duplicate requests
const cache = new Map<string, { articles: NewsAPIArticle[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useNewsAPISearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<NewsAPIArticle[]>([]);
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
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke<NewsAPISearchResult>(
        "newsapi-search",
        { body: { artistName, pageSize: 10 } }
      );

      // Silently handle errors - external APIs are unreliable
      if (fnError || !data) {
        console.info('NewsAPI search unavailable');
        if (cached) {
          setArticles(cached.articles);
        } else {
          setArticles([]);
        }
        return;
      }

      if (data.success && data.articles) {
        setArticles(data.articles);
        cache.set(artistName, { articles: data.articles, timestamp: Date.now() });
      } else {
        // Use cached if available, otherwise empty
        if (cached) {
          setArticles(cached.articles);
        } else {
          setArticles([]);
        }
      }
    } catch (err) {
      // Silently fail - don't show errors for external API issues
      console.info("NewsAPI search error:", err);
      if (cached) {
        setArticles(cached.articles);
      } else {
        setArticles([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { searchArtist, articles, isLoading };
}

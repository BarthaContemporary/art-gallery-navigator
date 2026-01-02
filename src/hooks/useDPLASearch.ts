import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DPLAResult {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  description: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  collection: string;
  provider: string;
  rights: string;
  source: string;
}

export interface DPLASearchResponse {
  results: DPLAResult[];
  totalResults: number;
  source: string;
}

export const useDPLASearch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DPLAResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const { toast } = useToast();

  const searchByArtist = async (artistName: string, limit: number = 20): Promise<DPLASearchResponse | null> => {
    if (!artistName.trim()) {
      toast({
        title: "Error",
        description: "Please provide an artist name",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dpla-search', {
        body: { artistName: artistName.trim(), limit }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.results || []);
      setTotalResults(data.totalResults || 0);

      return data as DPLASearchResponse;
    } catch (error: any) {
      console.error('DPLA search error:', error);
      toast({
        title: "Search Error",
        description: error.message || "Failed to search DPLA",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setTotalResults(0);
  };

  return {
    searchByArtist,
    clearResults,
    isLoading,
    results,
    totalResults
  };
};

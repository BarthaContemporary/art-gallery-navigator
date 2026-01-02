import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SmithsonianResult {
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
  unitCode: string;
  source: string;
}

export interface SmithsonianSearchResponse {
  results: SmithsonianResult[];
  totalResults: number;
  source: string;
}

export const useSmithsonianSearch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SmithsonianResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const { toast } = useToast();

  const searchByArtist = async (artistName: string, limit: number = 20): Promise<SmithsonianSearchResponse | null> => {
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
      const { data, error } = await supabase.functions.invoke('smithsonian-search', {
        body: { artistName: artistName.trim(), limit }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults(data.results || []);
      setTotalResults(data.totalResults || 0);

      return data as SmithsonianSearchResponse;
    } catch (error: any) {
      console.error('Smithsonian search error:', error);
      toast({
        title: "Search Error",
        description: error.message || "Failed to search Smithsonian",
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

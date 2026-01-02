import { useState, useCallback, useRef } from 'react';
import { SearchSource } from '@/components/artists/SearchProgressIndicator';

interface SearchFunction {
  id: string;
  name: string;
  search: (artistName: string) => Promise<void>;
  getResultCount: () => number;
}

interface UseSequentialSearchOptions {
  onSourceUpdate?: (sources: SearchSource[]) => void;
}

export function useSequentialSearch(
  searchFunctions: SearchFunction[],
  options?: UseSequentialSearchOptions
) {
  const [sources, setSources] = useState<SearchSource[]>(() =>
    searchFunctions.map(fn => ({
      id: fn.id,
      name: fn.name,
      icon: null as any, // Will be set by the component
      status: 'pending' as const,
    }))
  );
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef(false);

  const updateSource = useCallback((id: string, updates: Partial<SearchSource>) => {
    setSources(prev => {
      const newSources = prev.map(s => 
        s.id === id ? { ...s, ...updates } : s
      );
      options?.onSourceUpdate?.(newSources);
      return newSources;
    });
  }, [options]);

  const runSearches = useCallback(async (artistName: string) => {
    abortRef.current = false;
    setIsSearching(true);
    
    // Reset all sources to pending
    setSources(prev => prev.map(s => ({ ...s, status: 'pending' as const, resultCount: undefined })));

    for (const fn of searchFunctions) {
      if (abortRef.current) break;

      // Mark as searching
      updateSource(fn.id, { status: 'searching' });

      try {
        await fn.search(artistName);
        const count = fn.getResultCount();
        updateSource(fn.id, { status: 'complete', resultCount: count });
      } catch (error) {
        console.error(`Search error for ${fn.name}:`, error);
        updateSource(fn.id, { status: 'error', resultCount: 0 });
      }
    }

    setIsSearching(false);
  }, [searchFunctions, updateSource]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    sources,
    setSources,
    isSearching,
    runSearches,
    abort,
  };
}

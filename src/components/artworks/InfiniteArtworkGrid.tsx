import React, { useCallback, useEffect, useRef } from "react";
import { ArtworkCard } from "./ArtworkCard";
import { usePaginatedArtworks } from "@/hooks/use-paginated-artworks";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function InfiniteArtworkGrid() {
  const {
    artworks,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    error
  } = usePaginatedArtworks();

  const observer = useRef<IntersectionObserver>();
  const lastArtworkElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, loadMore, hasNextPage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading artworks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading artworks: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {artworks.map((artwork, index) => (
          <div
            key={artwork.id}
            ref={index === artworks.length - 1 ? lastArtworkElementRef : null}
          >
            <ArtworkCard artwork={artwork} />
          </div>
        ))}
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading more artworks...</span>
        </div>
      )}

      {!hasNextPage && artworks.length > 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No more artworks to load
        </div>
      )}

      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Button onClick={loadMore} variant="outline">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
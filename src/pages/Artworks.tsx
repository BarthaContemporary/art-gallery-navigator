import { ArtworksHeader } from "@/components/artworks/ArtworksHeader";
import { ArtworksFilters } from "@/components/artworks/ArtworksFilters";
import { ArtworksStats } from "@/components/artworks/ArtworksStats";
import { ModernArtworkGrid } from "@/components/artworks/modern/ModernArtworkGrid";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useArtworksPageLogic } from "@/hooks/pages/useArtworksPageLogic";
import { useBackgroundImageProcessing } from "@/hooks/use-background-image-processing";

const Artworks = () => {
  const {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    typeFilter, setTypeFilter,
    artistFilter, setArtistFilter,
    activeIndex, setActiveIndex,
    viewMode, setViewMode,
    useVirtualization, setUseVirtualization,
    pageTopRef,
    containerHeight,
    isMobile,
    artworks,
    artworksLoading,
    artworksError,
    artistsLoading,
    artistsError,
    filteredArtworks,
    letters,
    handleScrollToTop,
    handleRefresh,
  } = useArtworksPageLogic();

  // Disable background image processing for faster initial load
  useBackgroundImageProcessing(false);

  if (artworksLoading || artistsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading artworks and artists...</p>
      </div>
    );
  }

  if (artworksError || artistsError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">
          {artworksError ? `Error loading artworks: ${artworksError.message}. ` : ''}
          {artistsError ? `Error loading artists: ${artistsError.message}. ` : ''}
          Please try again.
        </p>
      </div>
    );
  }

  const content = (
    <div className="p-3 md:p-6 max-w-7xl mx-auto" ref={pageTopRef}>
      <ArtworksHeader
        artworks={artworks}
        filteredArtworks={filteredArtworks}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <ArtworksStats
        filteredCount={filteredArtworks.length}
        totalCount={artworks.length}
        useVirtualization={useVirtualization}
      />

      <ArtworksFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        artistFilter={artistFilter}
        onArtistFilterChange={setArtistFilter}
        onShowAll={() => {
          setSearchTerm("");
          setStatusFilter(null);
          setTypeFilter(null);
          setArtistFilter(null);
        }}
      />

      <ModernArtworkGrid 
        artworks={filteredArtworks}
        loading={artworksLoading || artistsLoading}
        showActions={true}
      />
    </div>
  );

  if (isMobile) {
    return (
      <ErrorBoundary>
        <PullToRefresh onRefresh={handleRefresh} enabled={!artworksLoading && !artistsLoading}>
          {content}
        </PullToRefresh>
      </ErrorBoundary>
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
};

export default Artworks;

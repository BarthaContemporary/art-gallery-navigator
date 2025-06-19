
import { ArtworksHeader } from "@/components/artworks/ArtworksHeader";
import { ArtworksFilters } from "@/components/artworks/ArtworksFilters";
import { ArtworksStats } from "@/components/artworks/ArtworksStats";
import { ArtworksContent } from "@/components/artworks/ArtworksContent";
import { ImageHealthDashboard } from "@/components/artworks/ImageHealthDashboard";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArtworksPageLogic } from "@/hooks/pages/useArtworksPageLogic";

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

  const handleShowAll = () => {
    setSearchTerm("");
    setStatusFilter(null);
    setTypeFilter(null);
    setArtistFilter(null);
  };

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
      <Tabs defaultValue="artworks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="artworks">Artworks</TabsTrigger>
          <TabsTrigger value="images">Image Health</TabsTrigger>
        </TabsList>
        
        <TabsContent value="artworks" className="space-y-6">
          <ArtworksHeader
            artworks={artworks}
            filteredArtworks={filteredArtworks}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
            onShowAll={handleShowAll}
          />

          <ArtworksStats
            filteredCount={filteredArtworks.length}
            totalCount={artworks.length}
            useVirtualization={useVirtualization}
          />

          <ArtworksContent
            artworks={filteredArtworks}
            viewMode={viewMode}
            useVirtualization={useVirtualization}
            containerHeight={containerHeight}
            letters={letters}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onScrollToTop={handleScrollToTop}
          />
        </TabsContent>
        
        <TabsContent value="images">
          <ImageHealthDashboard />
        </TabsContent>
      </Tabs>
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

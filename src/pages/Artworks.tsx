import { ArtworksHeader } from "@/components/artworks/ArtworksHeader";
import { ArtworksFilters } from "@/components/artworks/ArtworksFilters";
import { ArtworksStats } from "@/components/artworks/ArtworksStats";
import { ModernArtworkGrid } from "@/components/artworks/modern/ModernArtworkGrid";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useArtworksPageLogic } from "@/hooks/pages/useArtworksPageLogic";
import { useBackgroundImageProcessing } from "@/hooks/use-background-image-processing";
import { useImagePerformanceMonitor } from "@/hooks/use-image-performance-monitor";
import { useCloudinaryHealth } from "@/hooks/use-cloudinary-health";

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
  
  // Performance and health monitoring
  const { health } = useCloudinaryHealth();
  const performanceMonitor = useImagePerformanceMonitor();

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
      {/* Development: Performance & Health Status */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 p-4 bg-muted/20 rounded-lg text-sm">
          <div className="font-semibold mb-3">Phase 3 & 4: Performance Monitor</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="font-medium">Health Status</div>
              <div className={health.isHealthy ? 'text-green-600' : 'text-amber-600'}>
                {health.isHealthy ? '✓ Healthy' : '⚠ Degraded'}
              </div>
              <div className="text-muted-foreground">
                {health.consecutiveErrors} errors
              </div>
            </div>
            <div>
              <div className="font-medium">Images Loaded</div>
              <div>{performanceMonitor.metrics.totalLoads}</div>
            </div>
            <div>
              <div className="font-medium">Avg Load Time</div>
              <div>{performanceMonitor.metrics.averageLoadTime.toFixed(0)}ms</div>
            </div>
            <div>
              <div className="font-medium">Error Rate</div>
              <div className={performanceMonitor.metrics.errorRate > 0.1 ? 'text-amber-600' : 'text-green-600'}>
                {(performanceMonitor.metrics.errorRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Sources: S{performanceMonitor.metrics.sourceBreakdown.supabase} | 
            C{performanceMonitor.metrics.sourceBreakdown.cloudinary} | 
            F{performanceMonitor.metrics.sourceBreakdown.fallback} | 
            P{performanceMonitor.metrics.sourceBreakdown.placeholder}
          </div>
        </div>
      )}
      
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

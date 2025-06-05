
import { Button } from "@/components/ui/button";
import { CreateArtistDialog } from "@/components/artists/CreateArtistDialog";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useArtistsPage } from "./Artists/hooks/useArtistsPage";
import { ArtistsHeader } from "./Artists/components/ArtistsHeader";
import { ArtistsFilters } from "./Artists/components/ArtistsFilters";
import { ArtistsContent } from "./Artists/components/ArtistsContent";

const Artists = () => {
  const {
    searchTerm,
    setSearchTerm,
    createArtistDialogOpen,
    setCreateArtistDialogOpen,
    statusFilter,
    setStatusFilter,
    viewMode,
    handleViewModeChange,
    isMobile,
    artists,
    filteredArtists,
    isLoading,
    error,
    handleRefresh
  } = useArtistsPage();

  if (error) {
    console.error('Artists page error:', error);
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <p className="text-red-500 mb-4">Failed to load artists</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      <ArtistsHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onCreateArtist={() => setCreateArtistDialogOpen(true)}
        artists={artists}
        filteredArtists={filteredArtists}
      />
      
      <CreateArtistDialog open={createArtistDialogOpen} onOpenChange={setCreateArtistDialogOpen} />

      <ArtistsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <ArtistsContent
        isLoading={isLoading}
        filteredArtists={filteredArtists}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        viewMode={viewMode}
      />
    </div>
  );

  // Wrap with PullToRefresh only on mobile
  if (isMobile) {
    return (
      <PullToRefresh onRefresh={handleRefresh} enabled={!isLoading}>
        {content}
      </PullToRefresh>
    );
  }

  return content;
};

export default Artists;


import { useState } from "react";
import { LocationSearch } from "@/components/locations/LocationSearch";
import { LocationGrid } from "@/components/locations/LocationGrid";
import { LocationListView } from "@/components/locations/LocationListView";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateLocationDialog } from "@/components/locations/CreateLocationDialog";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import { useLocations } from "@/hooks/use-locations";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('locations-view-mode') as ViewMode) || 'grid';
  });
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: locations, isLoading, isError, refetch } = useLocations();

  const filteredLocations = locations?.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (location.address || "").toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  // Persist view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('locations-view-mode', mode);
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success("Locations refreshed successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh locations");
    }
  };

  const content = (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 mb-4 md:mb-6">
        {/* Header with title and action buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <PageHeader title="LOCATIONS" />
          <div className="flex items-center gap-2">
            <CreateLocationDialog />
            <div className="hidden md:block">
              <ViewToggle 
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          </div>
        </div>
        
        {/* Mobile view toggle - show below header on mobile */}
        <div className="md:hidden">
          <ViewToggle 
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </div>
      </div>
      
      <LocationSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      
      {isLoading ? (
        <div className="text-center text-muted-foreground py-20">Loading locations...</div>
      ) : isError ? (
        <div className="text-center text-red-500 py-20">Failed to load locations. Please try again.</div>
      ) : filteredLocations.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">No locations found.</div>
      ) : viewMode === 'list' ? (
        <LocationListView locations={filteredLocations} />
      ) : (
        <LocationGrid searchTerm={searchTerm} />
      )}
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

export default Locations;

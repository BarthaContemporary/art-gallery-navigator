
import { LocationCard } from "./LocationCard";
import { useLocations } from "@/hooks/use-locations";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { DeleteLocationDialog } from "./components/DeleteLocationDialog";

interface LocationGridProps {
  searchTerm: string;
}

export function LocationGrid({ searchTerm }: LocationGridProps) {
  const { data: locations, isLoading, isError } = useLocations();
  const { isAdmin } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

  const filteredLocations = locations?.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (location.address || "").toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const handleDeleteRequest = (locationId: string) => {
    setLocationToDelete(locationId);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-20">Loading locations...</div>;
  }

  if (isError) {
    return <div className="text-center text-red-500 py-20">Failed to load locations. Please try again.</div>;
  }

  if (filteredLocations.length === 0) {
    return <div className="text-center text-muted-foreground py-20">No locations found.</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => (
          <LocationCard 
            key={location.id} 
            location={location}
            isAdmin={isAdmin}
            onDelete={handleDeleteRequest}
          />
        ))}
      </div>

      <DeleteLocationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        locationId={locationToDelete}
      />
    </>
  );
}

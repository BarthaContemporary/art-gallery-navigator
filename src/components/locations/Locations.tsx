
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { useLocations } from "@/hooks/use-locations";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditLocationDialog } from "@/components/locations/EditLocationDialog";
import { getLocationIcon } from "./utils/location-icons";
import { LocationActions } from "./components/LocationActions";
import { DeleteLocationDialog } from "./components/DeleteLocationDialog";
import { SearchInput } from "./components/SearchInput";
import { MapPin } from "lucide-react";
import { Location } from "@/hooks/use-locations";

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: locations, isLoading, isError } = useLocations();
  const { isAdmin } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    return locations.filter(location =>
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (location.address || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  const handleDelete = async (locationId: string) => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      toast.success("Location deleted successfully");
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error("Failed to delete location");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="pt-6 pb-6 px-6">
      <LocationHeader />

      <SearchInput 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
      />

      {isLoading ? (
        <div className="text-center text-muted-foreground py-20">Loading locations...</div>
      ) : isError ? (
        <div className="text-center text-red-500 py-20">Failed to load locations. Please try again.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLocations.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground">No locations found.</div>
          ) : (
            filteredLocations.map((location) => (
              <Card key={location.id} className="group relative">
                {isAdmin && (
                  <LocationActions
                    location={location}
                    onEdit={(loc) => {
                      setEditLocation(loc);
                      setEditDialogOpen(true);
                    }}
                    onDelete={(id) => {
                      setLocationToDelete(id);
                      setDeleteDialogOpen(true);
                    }}
                  />
                )}
                <CardHeader className="flex flex-row items-center gap-3 pb-1">
                  <div className="flex-shrink-0">
                    {getLocationIcon(location.type, "h-4 w-4")}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{location.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{location.type}</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground line-clamp-2">{location.address || "No address"}</span>
                    </div>
                    {location.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{location.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {editLocation && (
        <EditLocationDialog
          location={editLocation}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditLocation(null);
          }}
        />
      )}

      <DeleteLocationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        locationId={locationToDelete}
        onConfirm={() => locationToDelete && handleDelete(locationToDelete)}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Locations;

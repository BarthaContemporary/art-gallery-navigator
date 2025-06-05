
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditLocationDialog } from "@/components/locations/EditLocationDialog";
import { DeleteLocationDialog } from "@/components/locations/components/DeleteLocationDialog";
import { getLocationIcon } from "@/components/locations/utils/location-icons";
import { Location } from "@/hooks/use-locations";

interface LocationListViewProps {
  locations: Location[];
}

export function LocationListView({ locations }: LocationListViewProps) {
  const { isAdmin } = useAuth();
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setEditDialogOpen(true);
  };

  const handleDeleteRequest = (locationId: string) => {
    setLocationToDelete(locationId);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      {locations.map((location) => (
        <Card key={location.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Location Icon */}
              <div className="flex-shrink-0">
                {getLocationIcon(location.type)}
              </div>

              {/* Location Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{location.name}</h3>
                    
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="capitalize font-medium">{location.type}</span>
                    </div>

                    <div className="flex items-start gap-2 mt-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {location.address || "No address provided"}
                      </span>
                    </div>

                    {location.notes && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p className="line-clamp-2">{location.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(location)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRequest(location.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingLocation && (
        <EditLocationDialog
          location={editingLocation}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingLocation(null);
          }}
        />
      )}

      <DeleteLocationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        locationId={locationToDelete}
      />
    </div>
  );
}


import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Location } from "@/hooks/use-locations";
import { getLocationIcon } from "./utils/location-icons";
import { MapPin } from "lucide-react";
import { EditLocationDialog } from "./EditLocationDialog";
import { useState } from "react";
import { LocationActions } from "./components/LocationActions";

interface LocationCardProps {
  location: Location;
  isAdmin: boolean;
  onDelete: (locationId: string) => void;
}

export function LocationCard({ location, isAdmin, onDelete }: LocationCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const handleEdit = (location: Location) => {
    setEditDialogOpen(true);
  };

  return (
    <>
      <Card key={location.id} className="group relative">
        {isAdmin && (
          <LocationActions
            location={location}
            onEdit={handleEdit}
            onDelete={onDelete}
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

      {editDialogOpen && (
        <EditLocationDialog
          location={location}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </>
  );
}

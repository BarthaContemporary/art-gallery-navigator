
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

  return (
    <>
      <Card key={location.id} className="group relative">
        {isAdmin && (
          <LocationActions
            location={location}
            onEdit={() => setEditDialogOpen(true)}
            onDelete={() => onDelete(location.id)}
          />
        )}
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          {getLocationIcon(location.type)}
          <div>
            <h3 className="font-semibold text-lg">{location.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{location.type}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span className="text-sm">{location.address || "No address"}</span>
            </div>
            <p className="text-sm text-muted-foreground">{location.notes || ""}</p>
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

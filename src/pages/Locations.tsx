import { useState, useMemo } from "react";
import { Search, Building, Warehouse, Briefcase, ExternalLink, MapPin, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { useLocations } from "@/hooks/use-locations";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EditLocationDialog } from "@/components/locations/EditLocationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getLocationIcon = (type: string) => {
  switch (type) {
    case "exhibition":
      return <Building className="h-10 w-10 text-blue-500" />;
    case "storage":
      return <Warehouse className="h-10 w-10 text-amber-500" />;
    case "consignment":
      return <Briefcase className="h-10 w-10 text-purple-500" />;
    case "external":
      return <ExternalLink className="h-10 w-10 text-green-500" />;
    default:
      return <MapPin className="h-10 w-10 text-gray-500" />;
  }
};

const Locations = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: locations, isLoading, isError } = useLocations();
  const { isAdmin } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editLocation, setEditLocation] = useState<typeof locations[0] | null>(null);
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

      <div className="mb-8 mt-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search locations..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-20">Loading locations...</div>
      ) : isError ? (
        <div className="text-center text-red-500 py-20">Failed to load locations. Please try again.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocations.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground">No locations found.</div>
          ) : (
            filteredLocations.map((location) => (
              <Card key={location.id} className="group relative">
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Actions for {location.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditLocation(location);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          setLocationToDelete(location.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this location
              and may affect any artworks associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => locationToDelete && handleDelete(locationToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Locations;

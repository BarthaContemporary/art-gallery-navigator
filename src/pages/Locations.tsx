
import { useState, useMemo } from "react";
import { Search, Building, Warehouse, Briefcase, ExternalLink, MapPin, Edit } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { useLocations } from "@/hooks/use-locations";
import { useAuth } from "@/hooks/use-auth";

// Helper function for location type icons
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

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    return locations.filter(location =>
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (location.address || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

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
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit {location.name}</span>
                  </Button>
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
    </div>
  );
};

export default Locations;

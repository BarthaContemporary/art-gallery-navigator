import { useState } from "react";
import { Search, Building, Warehouse, Briefcase, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocationHeader } from "@/components/locations/LocationHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, MapPin, Building, Warehouse, Briefcase, ExternalLink } from "lucide-react";

// Mock data for locations
const mockLocations = [
  { 
    id: 1, 
    name: "Main Gallery", 
    type: "exhibition", 
    address: "123 Art Street, New York, NY 10001",
    notes: "Our primary exhibition space with three rooms and high ceilings. Natural light from north-facing windows.",
    artwork_count: 42
  },
  { 
    id: 2, 
    name: "East Wing", 
    type: "exhibition", 
    address: "123 Art Street, New York, NY 10001",
    notes: "Secondary exhibition space with two rooms. Used for smaller shows and special installations.",
    artwork_count: 28
  },
  { 
    id: 3, 
    name: "Main Storage", 
    type: "storage", 
    address: "456 Warehouse Ave, Brooklyn, NY 11211",
    notes: "Climate-controlled storage facility for majority of non-exhibited works. 24/7 security.",
    artwork_count: 76
  },
  { 
    id: 4, 
    name: "Project Space", 
    type: "exhibition", 
    address: "123 Art Street, New York, NY 10001",
    notes: "Experimental project space for emerging artists and installations.",
    artwork_count: 12
  },
  { 
    id: 5, 
    name: "MoMA Exhibition", 
    type: "consignment", 
    address: "11 West 53rd St, New York, NY 10019",
    notes: "Works on loan to MoMA for 'Contemporary Perspectives' exhibition until June 2025.",
    artwork_count: 8
  },
  { 
    id: 6, 
    name: "Private Collector - J. Smith", 
    type: "external", 
    address: "Private Address",
    notes: "Works at collector's residence for viewing period. Return expected by May 15, 2025.",
    artwork_count: 3
  }
];

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
  
  const filteredLocations = mockLocations.filter(location => 
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <LocationHeader />

      <div className="mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => (
          <Card key={location.id}>
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
                  <span className="text-sm">{location.address}</span>
                </div>
                <p className="text-sm text-muted-foreground">{location.notes}</p>
                <div className="pt-2">
                  <span className="text-sm font-medium">{location.artwork_count} artwork{location.artwork_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Locations;


import { Building, Warehouse, Briefcase, ExternalLink, MapPin, Palette } from "lucide-react";

export const getLocationIcon = (type: string) => {
  switch (type) {
    case "exhibition":
      return <Building className="h-10 w-10 text-blue-500" />;
    case "storage":
      return <Warehouse className="h-10 w-10 text-amber-500" />;
    case "consignment":
      return <Briefcase className="h-10 w-10 text-purple-500" />;
    case "external":
      return <ExternalLink className="h-10 w-10 text-green-500" />;
    case "artist studio":
    case "Artist Studio":
      return <Palette className="h-10 w-10 text-pink-500" />;
    default:
      return <MapPin className="h-10 w-10 text-gray-500" />;
  }
};

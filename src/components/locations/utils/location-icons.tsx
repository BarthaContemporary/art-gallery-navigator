
import { Building, Warehouse, Briefcase, ExternalLink, MapPin, Palette } from "lucide-react";

export const getLocationIcon = (type: string) => {
  switch (type) {
    case "exhibition":
      return <Building className="h-10 w-10" style={{ color: '#18465a' }} />;
    case "storage":
      return <Warehouse className="h-10 w-10" style={{ color: '#18465a' }} />;
    case "consignment":
      return <Briefcase className="h-10 w-10" style={{ color: '#18465a' }} />;
    case "external":
      return <ExternalLink className="h-10 w-10" style={{ color: '#18465a' }} />;
    case "artist studio":
    case "Artist Studio":
      return <Palette className="h-10 w-10" style={{ color: '#18465a' }} />;
    default:
      return <MapPin className="h-10 w-10" style={{ color: '#18465a' }} />;
  }
};


import { Building2, Home, Warehouse, MapPin, Archive, Truck } from "lucide-react";

export function getLocationIcon(type: string, className: string = "h-5 w-5") {
  const iconProps = {
    className: `${className} text-muted-foreground`,
  };

  switch (type.toLowerCase()) {
    case 'gallery':
      return <Building2 {...iconProps} />;
    case 'studio':
      return <Home {...iconProps} />;
    case 'clients home':
    case 'client home':
    case 'home':
      return <Home {...iconProps} />;
    case 'warehouse':
      return <Warehouse {...iconProps} />;
    case 'storage':
      return <Archive {...iconProps} />;
    case 'transit':
      return <Truck {...iconProps} />;
    default:
      return <MapPin {...iconProps} />;
  }
}

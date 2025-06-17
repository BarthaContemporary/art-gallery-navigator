
import { Building, Home, Warehouse, MapPin, Palette, ExternalLink } from "lucide-react";

export function getLocationIcon(type: string, className: string = "h-5 w-5") {
  const iconProps = {
    className: `${className} text-muted-foreground`,
  };

  switch (type.toLowerCase()) {
    case 'gallery':
      return <Building {...iconProps} />;
    case 'studio':
      return <Palette {...iconProps} />;
    case 'clients home':
    case 'client home':
    case 'home':
      return <ExternalLink {...iconProps} />;
    case 'warehouse':
    case 'storage':
      return <Warehouse {...iconProps} />;
    case 'transit':
      return <Home {...iconProps} />;
    default:
      return <MapPin {...iconProps} />;
  }
}

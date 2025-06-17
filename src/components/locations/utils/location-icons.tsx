
import { Building, Home, Warehouse, MapPin, Palette, ExternalLink } from "lucide-react";

export function getLocationIcon(type: string, className: string = "h-5 w-5") {
  const iconProps = {
    className: `${className} text-muted-foreground`,
  };

  // Add console logging to debug what location types we're receiving
  console.log('Location type received:', type);
  
  const normalizedType = type.toLowerCase().trim();
  console.log('Normalized type:', normalizedType);

  switch (normalizedType) {
    case 'gallery':
    case 'galleries':
      console.log('Using Building icon for gallery');
      return <Building {...iconProps} />;
    case 'exhibition':
    case 'exhibitions':
    case 'exhibition space':
      console.log('Using Building icon for exhibition');
      return <Building {...iconProps} />;
    case 'studio':
    case 'studios':
    case 'art studio':
    case 'artist studio':
      console.log('Using Palette icon for studio');
      return <Palette {...iconProps} />;
    case 'clients home':
    case 'client home':
    case 'client\'s home':
    case 'home':
    case 'residence':
      console.log('Using ExternalLink icon for client home');
      return <ExternalLink {...iconProps} />;
    case 'warehouse':
    case 'storage':
    case 'storage facility':
    case 'storage room':
      console.log('Using Warehouse icon for storage/warehouse');
      return <Warehouse {...iconProps} />;
    case 'transit':
    case 'in transit':
    case 'transportation':
      console.log('Using Home icon for transit');
      return <Home {...iconProps} />;
    case 'external':
    case 'external location':
      console.log('Using ExternalLink icon for external');
      return <ExternalLink {...iconProps} />;
    default:
      console.log('Using default MapPin icon for type:', type);
      return <MapPin {...iconProps} />;
  }
}

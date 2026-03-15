
import { LocationData } from "./mapState";
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";

export class GoogleMapCreator {
  async createMapInstance(
    containerRef: React.RefObject<HTMLDivElement>,
    location: LocationData,
    clientName: string
  ): Promise<{
    mapInstance: any;
    marker: any;
    infoWindow: any;
  }> {
    if (!containerRef.current) {
      throw createMapError(
        MAP_ERROR_CODES.CONTAINER_UNAVAILABLE,
        'Container became unavailable during map creation'
      );
    }

    if (!window.google?.maps) {
      throw createMapError(
        MAP_ERROR_CODES.SCRIPT_LOAD_FAILED,
        'Google Maps API not available'
      );
    }

    try {
      console.log('Creating Google Maps instance');
      
      // Create map
      const mapInstance = new (window as any).google.maps.Map(containerRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 16,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
      });

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstance,
        title: clientName,
        animation: google.maps.Animation.DROP
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif; max-width: 250px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${location.formatted_address}</p>
          </div>
        `,
      });

      // Add click listener to marker
      marker.addListener('click', () => {
        if (infoWindow && mapInstance) {
          infoWindow.open(mapInstance, marker);
        }
      });

      // Show info window briefly
      setTimeout(() => {
        if (infoWindow && mapInstance && marker) {
          infoWindow.open(mapInstance, marker);
          setTimeout(() => {
            if (infoWindow) {
              infoWindow.close();
            }
          }, 3000);
        }
      }, 500);

      console.log('Map creation completed successfully');
      
      return { mapInstance, marker, infoWindow };
    } catch (err) {
      throw createMapError(
        MAP_ERROR_CODES.MAP_CREATION_FAILED,
        'Failed to create map instance',
        { originalError: err }
      );
    }
  }
}

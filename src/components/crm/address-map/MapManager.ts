
import { LocationData } from "./types";
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";
import { formatAddressForGeocoding } from "./utils";
import { supabase } from "@/integrations/supabase/client";

export type MapState = 
  | 'idle'
  | 'loading'
  | 'geocoding'
  | 'script-loading'
  | 'map-creating'
  | 'ready'
  | 'error'
  | 'cleanup';

export interface MapManagerState {
  state: MapState;
  error: string | null;
  location: LocationData | null;
  retryCount: number;
}

export class MapManager {
  private state: MapState = 'idle';
  private error: string | null = null;
  private location: LocationData | null = null;
  private retryCount: number = 0;
  private mapInstance: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  private infoWindow: google.maps.InfoWindow | null = null;
  private abortController: AbortController | null = null;
  private cleanupCallbacks: (() => void)[] = [];
  private stateChangeCallback: ((state: MapManagerState) => void) | null = null;

  constructor(
    private containerRef: React.RefObject<HTMLDivElement>,
    private onStateChange?: (state: MapManagerState) => void
  ) {
    this.stateChangeCallback = onStateChange || null;
  }

  private setState(newState: MapState, error: string | null = null) {
    console.log(`Map state transition: ${this.state} → ${newState}`, error ? { error } : {});
    this.state = newState;
    this.error = error;
    
    if (this.stateChangeCallback) {
      this.stateChangeCallback({
        state: this.state,
        error: this.error,
        location: this.location,
        retryCount: this.retryCount
      });
    }
  }

  private isContainerReady(): boolean {
    if (!this.containerRef.current) {
      return false;
    }
    
    const container = this.containerRef.current;
    
    if (!container.isConnected) {
      return false;
    }
    
    const { width, height } = container.getBoundingClientRect();
    return width > 0 && height > 0;
  }

  private async waitForContainer(maxAttempts: number = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.isContainerReady()) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw createMapError(
      MAP_ERROR_CODES.CONTAINER_NOT_FOUND,
      'Map container is not ready after waiting',
      { attempts: maxAttempts }
    );
  }

  private async geocodeAddress(address: string): Promise<LocationData> {
    const formattedAddress = formatAddressForGeocoding(address);
    console.log('Geocoding address:', formattedAddress);

    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { address: formattedAddress }
      });

      if (error) {
        throw createMapError(
          MAP_ERROR_CODES.GEOCODING_FAILED,
          'Geocoding service error',
          { error: error.message }
        );
      }

      if (data.error) {
        if (data.error.includes('not found')) {
          throw createMapError(
            MAP_ERROR_CODES.ADDRESS_NOT_FOUND,
            'Address not found',
            { address: formattedAddress }
          );
        }
        throw createMapError(
          MAP_ERROR_CODES.GEOCODING_FAILED,
          data.error,
          { address: formattedAddress }
        );
      }

      if (!data.results || data.results.length === 0) {
        throw createMapError(
          MAP_ERROR_CODES.ADDRESS_NOT_FOUND,
          'No results found for address',
          { address: formattedAddress }
        );
      }

      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address
      };
    } catch (err) {
      if (err instanceof MapError) {
        throw err;
      }
      throw createMapError(
        MAP_ERROR_CODES.GEOCODING_FAILED,
        'Geocoding request failed',
        { originalError: err }
      );
    }
  }

  private async loadGoogleMapsScript(): Promise<void> {
    if (window.google?.maps) {
      return;
    }

    console.log('Loading Google Maps script...');
    
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw createMapError(
        MAP_ERROR_CODES.API_KEY_MISSING,
        'Google Maps API key not configured'
      );
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      const timeoutId = setTimeout(() => {
        reject(createMapError(
          MAP_ERROR_CODES.SCRIPT_LOAD_FAILED,
          'Google Maps script loading timeout'
        ));
      }, 10000);

      script.onload = () => {
        clearTimeout(timeoutId);
        console.log('Google Maps script loaded successfully');
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(createMapError(
          MAP_ERROR_CODES.SCRIPT_LOAD_FAILED,
          'Failed to load Google Maps script'
        ));
      };

      document.head.appendChild(script);
      
      this.cleanupCallbacks.push(() => {
        clearTimeout(timeoutId);
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    });
  }

  private async createMapInstance(location: LocationData, clientName: string): Promise<void> {
    if (!this.containerRef.current) {
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
      this.mapInstance = new google.maps.Map(this.containerRef.current, {
        center: { lat: location.lat, lng: location.lng },
        zoom: 16,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });

      // Create marker
      this.marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: this.mapInstance,
        title: clientName,
        animation: google.maps.Animation.DROP
      });

      // Create info window
      this.infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif; max-width: 250px;">
            <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px; color: #1f2937;">${clientName}</h3>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${location.formatted_address}</p>
          </div>
        `,
      });

      // Add click listener to marker
      this.marker.addListener('click', () => {
        if (this.infoWindow && this.mapInstance) {
          this.infoWindow.open(this.mapInstance, this.marker);
        }
      });

      // Show info window briefly
      setTimeout(() => {
        if (this.infoWindow && this.mapInstance && this.marker) {
          this.infoWindow.open(this.mapInstance, this.marker);
          setTimeout(() => {
            if (this.infoWindow) {
              this.infoWindow.close();
            }
          }, 3000);
        }
      }, 500);

      console.log('Map creation completed successfully');
    } catch (err) {
      throw createMapError(
        MAP_ERROR_CODES.MAP_CREATION_FAILED,
        'Failed to create map instance',
        { originalError: err }
      );
    }
  }

  async initialize(address: string, clientName: string): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'error') {
      console.log('Map initialization already in progress or completed');
      return;
    }

    this.abortController = new AbortController();
    this.setState('loading');

    try {
      // Step 1: Wait for container to be ready
      console.log('Step 1: Waiting for container...');
      await this.waitForContainer();
      
      if (!this.isContainerReady()) {
        throw createMapError(
          MAP_ERROR_CODES.CONTAINER_NOT_FOUND,
          'Container validation failed after waiting'
        );
      }

      // Step 2: Geocode address
      console.log('Step 2: Geocoding address...');
      this.setState('geocoding');
      this.location = await this.geocodeAddress(address);

      // Step 3: Load Google Maps script
      console.log('Step 3: Loading Google Maps script...');
      this.setState('script-loading');
      await this.loadGoogleMapsScript();

      // Step 4: Create map instance
      console.log('Step 4: Creating map instance...');
      this.setState('map-creating');
      await this.createMapInstance(this.location, clientName);

      // Step 5: Complete initialization
      console.log('Map initialization completed successfully');
      this.setState('ready');
      this.retryCount = 0;

    } catch (err) {
      console.error('Map initialization failed:', err);
      const errorMessage = err instanceof MapError ? err.message : 'Unknown error occurred';
      this.setState('error', errorMessage);
      throw err;
    }
  }

  async retry(address: string, clientName: string): Promise<void> {
    if (this.retryCount >= 3) {
      this.setState('error', 'Maximum retry attempts reached');
      return;
    }

    this.retryCount++;
    console.log(`Retrying map initialization (attempt ${this.retryCount})`);
    
    // Clean up before retry
    this.cleanup();
    
    // Wait with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Reset state and retry
    this.setState('idle');
    await this.initialize(address, clientName);
  }

  cleanup(): void {
    console.log('Cleaning up map resources...');
    this.setState('cleanup');

    // Abort any ongoing requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Clean up Google Maps objects
    try {
      if (this.infoWindow) {
        this.infoWindow.close();
        this.infoWindow = null;
      }

      if (this.marker) {
        this.marker.setMap(null);
        this.marker = null;
      }

      if (this.mapInstance) {
        // Allow garbage collection
        this.mapInstance = null;
      }
    } catch (err) {
      console.warn('Error during map cleanup:', err);
    }

    // Run cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (err) {
        console.warn('Error in cleanup callback:', err);
      }
    });
    this.cleanupCallbacks = [];

    this.setState('idle');
  }

  getState(): MapManagerState {
    return {
      state: this.state,
      error: this.error,
      location: this.location,
      retryCount: this.retryCount
    };
  }

  isReady(): boolean {
    return this.state === 'ready';
  }

  isLoading(): boolean {
    return ['loading', 'geocoding', 'script-loading', 'map-creating'].includes(this.state);
  }

  hasError(): boolean {
    return this.state === 'error';
  }
}

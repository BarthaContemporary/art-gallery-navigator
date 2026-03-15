
import { LocationData, MapState, MapManagerState } from "./mapState";
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";
import { GoogleMapsScriptLoader } from "./scriptLoader";
import { AddressGeocoder } from "./geocoder";
import { GoogleMapCreator } from "./mapCreator";
import { ContainerValidator } from "./containerValidator";

export class MapManager {
  private state: MapState = 'idle';
  private error: string | null = null;
  private location: LocationData | null = null;
  private retryCount: number = 0;
  private mapInstance: any = null;
  private marker: any = null;
  private infoWindow: any = null;
  private abortController: AbortController | null = null;
  private stateChangeCallback: ((state: MapManagerState) => void) | null = null;

  // Service instances
  private scriptLoader = new GoogleMapsScriptLoader();
  private geocoder = new AddressGeocoder();
  private mapCreator = new GoogleMapCreator();
  private containerValidator = new ContainerValidator();

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
      await this.containerValidator.waitForContainer(this.containerRef);
      
      if (!this.containerValidator.isContainerReady(this.containerRef)) {
        throw createMapError(
          MAP_ERROR_CODES.CONTAINER_NOT_FOUND,
          'Container validation failed after waiting'
        );
      }

      // Step 2: Geocode address
      console.log('Step 2: Geocoding address...');
      this.setState('geocoding');
      this.location = await this.geocoder.geocodeAddress(address);

      // Step 3: Load Google Maps script
      console.log('Step 3: Loading Google Maps script...');
      this.setState('script-loading');
      await this.scriptLoader.loadGoogleMapsScript();

      // Step 4: Create map instance
      console.log('Step 4: Creating map instance...');
      this.setState('map-creating');
      const { mapInstance, marker, infoWindow } = await this.mapCreator.createMapInstance(
        this.containerRef,
        this.location,
        clientName
      );

      this.mapInstance = mapInstance;
      this.marker = marker;
      this.infoWindow = infoWindow;

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

    // Clean up service instances
    this.scriptLoader.cleanup();

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

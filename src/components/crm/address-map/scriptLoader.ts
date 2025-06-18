
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";

export class GoogleMapsScriptLoader {
  private cleanupCallbacks: (() => void)[] = [];

  async loadGoogleMapsScript(): Promise<void> {
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

  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (err) {
        console.warn('Error in script cleanup callback:', err);
      }
    });
    this.cleanupCallbacks = [];
  }
}

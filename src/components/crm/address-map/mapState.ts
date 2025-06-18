
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

export interface LocationData {
  lat: number;
  lng: number;
  formatted_address: string;
}

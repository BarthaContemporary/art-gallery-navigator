
export interface AddressMapProps {
  address: string;
  clientName: string;
}

// Re-export types from mapState for backward compatibility
export type { LocationData, MapState, MapManagerState } from "./mapState";

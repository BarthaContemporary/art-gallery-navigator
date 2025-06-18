
export class MapError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MapError';
  }
}

export const MAP_ERROR_CODES = {
  CONTAINER_NOT_FOUND: 'CONTAINER_NOT_FOUND',
  CONTAINER_UNAVAILABLE: 'CONTAINER_UNAVAILABLE',
  GEOCODING_FAILED: 'GEOCODING_FAILED',
  SCRIPT_LOAD_FAILED: 'SCRIPT_LOAD_FAILED',
  MAP_CREATION_FAILED: 'MAP_CREATION_FAILED',
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  API_KEY_MISSING: 'API_KEY_MISSING',
  INITIALIZATION_TIMEOUT: 'INITIALIZATION_TIMEOUT'
} as const;

export function createMapError(code: string, message: string, context?: Record<string, any>): MapError {
  return new MapError(message, code, context);
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: Element, opts?: any);
    }
    class Marker {
      constructor(opts?: any);
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: Function): void;
    }
    class InfoWindow {
      constructor(opts?: any);
      open(map?: Map, anchor?: Marker): void;
      close(): void;
    }
    enum Animation {
      BOUNCE = 1,
      DROP = 2,
    }
    const MapTypeId: {
      ROADMAP: string;
      SATELLITE: string;
      HYBRID: string;
      TERRAIN: string;
    };
  }
}

interface Window {
  google?: typeof google;
}

declare namespace google.maps {
  class Map {
    constructor(mapDiv: Element, opts?: any);
  }
  class Marker {
    constructor(opts?: any);
    setMap(map: Map | null): void;
    addListener(eventName: string, handler: Function): any;
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

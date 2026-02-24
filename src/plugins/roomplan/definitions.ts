/**
 * RoomPlan Scanner Capacitor Plugin
 * Wraps Apple's RoomPlan API (iOS 16+, LiDAR devices only)
 * to capture room geometry and generate 2D floorplan outlines.
 */

export interface RoomPlanPoint {
  x: number;
  y: number;
}

export interface RoomPlanWall {
  /** Start and end points in metres (2D top-down projection) */
  start: RoomPlanPoint;
  end: RoomPlanPoint;
  /** Height in metres */
  height: number;
}

export interface RoomPlanOpening {
  type: "door" | "window" | "opening";
  start: RoomPlanPoint;
  end: RoomPlanPoint;
  /** Width in metres */
  width: number;
}

export interface RoomPlanObject {
  type: string;
  center: RoomPlanPoint;
  /** Dimensions in metres */
  width: number;
  depth: number;
}

export interface RoomScanResult {
  /** Unique scan identifier */
  scanId: string;
  /** Room dimensions in metres */
  roomWidth: number;
  roomDepth: number;
  /** Scanned wall segments */
  walls: RoomPlanWall[];
  /** Doors, windows, openings */
  openings: RoomPlanOpening[];
  /** Detected objects (tables, chairs, etc.) */
  objects: RoomPlanObject[];
  /** Overall polygon outline of the room (convex hull of walls) */
  outline: RoomPlanPoint[];
  /** Timestamp of scan */
  scannedAt: string;
}

export interface RoomPlanScannerPlugin {
  /**
   * Check if the device supports RoomPlan (iOS 16+, LiDAR sensor)
   */
  isSupported(): Promise<{ supported: boolean; reason?: string }>;

  /**
   * Launch the RoomPlan scanning session.
   * Returns the captured room data as a 2D floorplan projection.
   */
  startScan(): Promise<RoomScanResult>;
}

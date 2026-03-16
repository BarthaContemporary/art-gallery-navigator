/**
 * Floorplan-Aware Angular Computation
 * 
 * Uses the camera's position on the floorplan + room geometry (walls from
 * LiDAR scan or floorplan outline) to compute the expected angular span
 * each photo covers. This replaces the naive equal-division assumption.
 * 
 * When a camera is close to a wall, photos facing that wall cover a wider
 * angular range (perspective compression), while photos facing far walls
 * cover a narrower range.
 */

import type { RoomScanResult, RoomPlanWall } from "@/plugins/roomplan/definitions";

export interface SpatialConfig {
  /** Camera position on the floorplan grid (grid units) */
  cameraX: number;
  cameraY: number;
  /** Room scan data if available */
  roomScan?: RoomScanResult | null;
  /** Number of photos in the panorama */
  photoCount: number;
  /** Per-photo horizontal FOV in degrees */
  photoFOV: number;
  /** Initial heading offset in degrees (0 = north/up) */
  initialHeading?: number;
}

export interface PhotoAngularSpan {
  /** Center angle of this photo in degrees (0-360) */
  centerAngle: number;
  /** Angular width this photo should span in the equirectangular output */
  angularWidth: number;
  /** Distance to nearest wall in this direction (metres), if available */
  wallDistance: number | null;
  /** Exposure compensation factor based on distance (further walls = darker) */
  distanceExposureFactor: number;
}

/**
 * Compute the distance from a point to the nearest wall segment
 * along a given direction (angle in radians).
 */
function distanceToWallInDirection(
  cx: number,
  cy: number,
  angle: number,
  walls: RoomPlanWall[],
): number | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let minDist: number | null = null;

  for (const wall of walls) {
    // Ray-segment intersection
    const ex = wall.start.x, ey = wall.start.y;
    const fx = wall.end.x, fy = wall.end.y;

    const denom = dx * (fy - ey) - dy * (fx - ex);
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((ex - cx) * (fy - ey) - (ey - cy) * (fx - ex)) / denom;
    const u = ((ex - cx) * dy - (ey - cy) * dx) / denom;

    if (t > 0.01 && u >= 0 && u <= 1) {
      if (minDist === null || t < minDist) {
        minDist = t;
      }
    }
  }

  return minDist;
}

/**
 * Compute angular spans for each photo based on the camera's position
 * relative to room geometry.
 * 
 * When spatial data is unavailable, falls back to uniform distribution.
 */
export function computePhotoAngles(config: SpatialConfig): PhotoAngularSpan[] {
  const {
    cameraX,
    cameraY,
    roomScan,
    photoCount,
    photoFOV,
    initialHeading = 0,
  } = config;

  const results: PhotoAngularSpan[] = [];

  if (!roomScan || !roomScan.walls.length) {
    // Uniform fallback
    const uniformAngle = 360 / photoCount;
    for (let i = 0; i < photoCount; i++) {
      results.push({
        centerAngle: (initialHeading + i * uniformAngle) % 360,
        angularWidth: uniformAngle,
        wallDistance: null,
        distanceExposureFactor: 1.0,
      });
    }
    return results;
  }

  // Compute wall distances at each photo direction
  const uniformAngle = 360 / photoCount;
  const distances: (number | null)[] = [];

  for (let i = 0; i < photoCount; i++) {
    const centerDeg = (initialHeading + i * uniformAngle) % 360;
    const centerRad = (centerDeg * Math.PI) / 180;
    const dist = distanceToWallInDirection(cameraX, cameraY, centerRad, roomScan.walls);
    distances.push(dist);
  }

  // Compute angular corrections based on distance
  // Photos facing closer walls should span MORE angle (objects are bigger)
  // Photos facing farther walls should span LESS angle
  const validDistances = distances.filter((d): d is number => d !== null);

  if (validDistances.length === 0) {
    // No wall intersections found — uniform
    for (let i = 0; i < photoCount; i++) {
      results.push({
        centerAngle: (initialHeading + i * uniformAngle) % 360,
        angularWidth: uniformAngle,
        wallDistance: null,
        distanceExposureFactor: 1.0,
      });
    }
    return results;
  }

  const avgDist = validDistances.reduce((a, b) => a + b, 0) / validDistances.length;

  // Angular weight: inversely proportional to distance
  // Closer walls → larger apparent angular span
  const weights: number[] = distances.map((d) => {
    if (d === null) return 1;
    return avgDist / Math.max(0.1, d);
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < photoCount; i++) {
    const centerDeg = (initialHeading + i * uniformAngle) % 360;
    const angularWidth = (weights[i] / totalWeight) * 360;
    const dist = distances[i];

    // Exposure factor: farther walls receive less light (inverse square, dampened)
    let exposureFactor = 1.0;
    if (dist !== null && avgDist > 0) {
      // Dampen the effect to avoid extreme corrections
      exposureFactor = Math.pow(avgDist / Math.max(0.1, dist), 0.3);
      exposureFactor = Math.max(0.7, Math.min(1.4, exposureFactor));
    }

    results.push({
      centerAngle: centerDeg,
      angularWidth,
      wallDistance: dist,
      distanceExposureFactor: exposureFactor,
    });
  }

  return results;
}

/**
 * Given computed angular spans, map a pixel column in the equirectangular
 * output to the correct source photo index and position within that photo.
 */
export function mapColumnToPhoto(
  outputX: number,
  outputWidth: number,
  spans: PhotoAngularSpan[],
): { photoIndex: number; normalizedX: number } {
  // Convert output column to angle
  const angle = (outputX / outputWidth) * 360;

  // Build cumulative angle ranges
  let cumAngle = spans[0].centerAngle - spans[0].angularWidth / 2;
  if (cumAngle < 0) cumAngle += 360;

  for (let i = 0; i < spans.length; i++) {
    const start = cumAngle;
    const end = start + spans[i].angularWidth;

    // Normalize angle to check containment (handle wraparound)
    let normAngle = angle;
    if (start > end - 360) {
      if (normAngle < start) normAngle += 360;
    }

    if (normAngle >= start && normAngle < end) {
      const normalizedX = (normAngle - start) / spans[i].angularWidth;
      return { photoIndex: i, normalizedX };
    }

    cumAngle = end % 360;
  }

  // Fallback to nearest
  return { photoIndex: 0, normalizedX: 0.5 };
}

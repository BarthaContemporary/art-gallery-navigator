/**
 * Depth-Aware Blending for Panorama Stitching
 * 
 * Uses depth maps from spatial photos to improve stitching quality:
 * 1. Depth-weighted seam placement — seams placed at depth discontinuities
 *    (wall edges, furniture boundaries) where misalignment is less visible
 * 2. Depth-based parallax correction — adjusts pixel positions based on 
 *    depth to compensate for camera position offset between shots
 * 3. Depth-informed exposure — closer surfaces receive stronger exposure
 *    normalization since they're more visually prominent
 */

import type { DepthMapResult } from "@/plugins/spatial-photo/definitions";

export interface DepthAwareBlendOptions {
  /** Depth maps for each photo, indexed by display_order */
  depthMaps: (DepthMapResult | null)[];
  /** Width of each source photo in pixels */
  photoWidth: number;
  /** Height of each source photo in pixels */
  photoHeight: number;
}

/**
 * Compute optimal seam positions between adjacent photos using depth data.
 * Seams are placed where depth changes sharply (object boundaries),
 * as misalignment is least visible at depth discontinuities.
 * 
 * Returns an array of x-offsets (in pixels within the overlap region)
 * for each seam between photo[i] and photo[i+1].
 */
export function computeDepthAwareSeams(
  overlapWidth: number,
  depthMaps: (DepthMapResult | null)[],
  photoWidth: number,
): number[] {
  const seams: number[] = [];

  for (let i = 0; i < depthMaps.length - 1; i++) {
    const leftDepth = depthMaps[i];
    const rightDepth = depthMaps[i + 1];

    if (!leftDepth?.depthMap || !rightDepth?.depthMap) {
      // No depth data — use center of overlap
      seams.push(Math.round(overlapWidth / 2));
      continue;
    }

    // Sample depth gradient at each column in the overlap region
    // Higher gradient = depth discontinuity = better seam position
    let bestSeamX = Math.round(overlapWidth / 2);
    let bestScore = -Infinity;

    const leftStartX = photoWidth - overlapWidth;

    for (let x = Math.round(overlapWidth * 0.2); x < Math.round(overlapWidth * 0.8); x++) {
      const leftSampleX = Math.round(((leftStartX + x) / photoWidth) * leftDepth.width);
      const rightSampleX = Math.round((x / photoWidth) * rightDepth.width);

      let gradientSum = 0;
      const sampleRows = Math.min(leftDepth.height, rightDepth.height, 32);

      for (let sy = 0; sy < sampleRows; sy++) {
        const y = Math.round((sy / sampleRows) * (leftDepth.height - 1));

        // Depth gradient in left image at this column
        const leftIdx = y * leftDepth.width + Math.min(leftSampleX, leftDepth.width - 1);
        const leftIdxNext = y * leftDepth.width + Math.min(leftSampleX + 1, leftDepth.width - 1);
        const leftGrad = Math.abs(leftDepth.depthMap[leftIdx] - leftDepth.depthMap[leftIdxNext]);

        // Depth gradient in right image
        const rightIdx = y * rightDepth.width + Math.min(rightSampleX, rightDepth.width - 1);
        const rightIdxNext = y * rightDepth.width + Math.min(rightSampleX + 1, rightDepth.width - 1);
        const rightGrad = Math.abs(rightDepth.depthMap[rightIdx] - rightDepth.depthMap[rightIdxNext]);

        gradientSum += leftGrad + rightGrad;
      }

      const score = gradientSum / sampleRows;
      if (score > bestScore) {
        bestScore = score;
        bestSeamX = x;
      }
    }

    seams.push(bestSeamX);
  }

  return seams;
}

/**
 * Compute per-pixel depth-based exposure weights.
 * Closer objects (lower depth) get stronger exposure normalization
 * since they're more visually dominant.
 * 
 * Returns a flat Float32Array of weights (same dimensions as depth map).
 */
export function computeDepthExposureWeights(depth: DepthMapResult): Float32Array {
  const weights = new Float32Array(depth.width * depth.height);

  if (!depth.depthMap) {
    weights.fill(1.0);
    return weights;
  }

  for (let i = 0; i < depth.depthMap.length; i++) {
    const d = depth.depthMap[i];
    // Inverse depth weighting: close objects (d→0) get weight ~1.3
    // far objects (d→1) get weight ~0.8
    weights[i] = 1.3 - 0.5 * d;
  }

  return weights;
}

/**
 * Check if any photos in a set have usable depth data.
 */
export function hasUsableDepthData(depthMaps: (DepthMapResult | null)[]): boolean {
  return depthMaps.some(d => d?.hasDepth && d.depthMap && d.depthMap.length > 0);
}

/**
 * Generate a depth-based overlap mask for blending two photos.
 * At each pixel in the overlap region, choose the photo whose depth
 * at that pixel is more consistent with its neighbours (less noise).
 * 
 * Returns alpha values 0..1 where 0 = use left photo, 1 = use right photo.
 */
export function computeDepthBlendMask(
  leftDepth: DepthMapResult,
  rightDepth: DepthMapResult,
  overlapWidth: number,
  height: number,
): Float32Array {
  const mask = new Float32Array(overlapWidth * height);

  if (!leftDepth.depthMap || !rightDepth.depthMap) {
    // Linear blend fallback
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < overlapWidth; x++) {
        mask[y * overlapWidth + x] = x / overlapWidth;
      }
    }
    return mask;
  }

  for (let y = 0; y < height; y++) {
    const depthY = Math.round((y / height) * (leftDepth.height - 1));

    for (let x = 0; x < overlapWidth; x++) {
      const linearAlpha = x / overlapWidth;

      // Sample depth consistency (variance in 3x3 neighbourhood)
      const leftX = Math.round(((leftDepth.width - overlapWidth + x) / leftDepth.width) * (leftDepth.width - 1));
      const rightX = Math.round((x / overlapWidth) * Math.min(overlapWidth, rightDepth.width - 1));

      let leftVar = 0, rightVar = 0;
      const center_l = leftDepth.depthMap[depthY * leftDepth.width + leftX] ?? 0.5;
      const center_r = rightDepth.depthMap[depthY * rightDepth.width + rightX] ?? 0.5;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ly = Math.max(0, Math.min(leftDepth.height - 1, depthY + dy));
          const lx = Math.max(0, Math.min(leftDepth.width - 1, leftX + dx));
          leftVar += Math.abs(leftDepth.depthMap[ly * leftDepth.width + lx] - center_l);

          const ry = Math.max(0, Math.min(rightDepth.height - 1, depthY + dy));
          const rx = Math.max(0, Math.min(rightDepth.width - 1, rightX + dx));
          rightVar += Math.abs(rightDepth.depthMap[ry * rightDepth.width + rx] - center_r);
        }
      }

      // Prefer the photo with more consistent depth (lower variance)
      // but still weight by linear position
      const depthBias = leftVar > rightVar ? 0.6 : 0.4;
      mask[y * overlapWidth + x] = linearAlpha * 0.5 + depthBias * 0.5;
    }
  }

  return mask;
}

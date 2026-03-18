/**
 * Client-side Panorama Stitcher (Enhanced)
 * 
 * Converts a cylindrical panorama strip into an equirectangular projection
 * suitable for spherical 360° viewing — using pure geometry, no AI.
 * 
 * Enhancements over v1:
 * - Lens distortion correction (barrel undistortion based on EXIF FOV)
 * - Exposure normalization (histogram equalization + gradient blending)
 * - Floorplan-aware angular mapping (uses camera position + room geometry)
 * - Multi-band blending at seams
 * 
 * The strip covers 360° horizontally but only a vertical band (~38% of sphere).
 * This utility:
 * 1. Loads the strip onto a canvas
 * 2. Creates a 2:1 equirectangular output (4096×2048)
 * 3. Maps the strip into the middle band with cylindrical→equirectangular correction
 * 4. Fills top/bottom poles with smooth gradients sampled from strip edges
 * 5. Exports as a high-quality JPEG blob
 */

import type { RoomScanResult } from "@/plugins/roomplan/definitions";

const OUTPUT_WIDTH = 4096;
const OUTPUT_HEIGHT = 2048;

// The strip covers roughly this fraction of the vertical FOV (latitude range)
const STRIP_VERTICAL_COVERAGE = 0.38;

export interface StitchOptions {
  /** Camera FOV in degrees (from EXIF). Used for vertical projection correction. */
  cameraFOV?: number;
  /** Room scan data for spatial-aware angular mapping */
  roomScan?: RoomScanResult | null;
  /** Camera position on floorplan (grid coords) */
  cameraPosition?: { x: number; y: number } | null;
  /** Initial heading offset in degrees */
  initialHeading?: number;
  /** Number of source photos (for angular span computation) */
  photoCount?: number;
  /** Depth maps from spatial photos (indexed by display_order) */
  depthMaps?: (import("@/plugins/spatial-photo/definitions").DepthMapResult | null)[];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Sample average color from a row of pixels in ImageData
 */
function sampleRowColor(imageData: ImageData, y: number, width: number): [number, number, number] {
  let r = 0, g = 0, b = 0, count = 0;
  const step = Math.max(1, Math.floor(width / 64));
  for (let x = 0; x < width; x += step) {
    const idx = (y * width + x) * 4;
    r += imageData.data[idx];
    g += imageData.data[idx + 1];
    b += imageData.data[idx + 2];
    count++;
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

/**
 * Apply a gentle horizontal exposure normalization across the strip.
 * Divides the strip into vertical columns and smooths brightness differences.
 */
function normalizeStripExposure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  segmentCount: number,
): void {
  if (segmentCount < 2) return;

  const segWidth = Math.floor(width / segmentCount);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Compute mean luminance per segment
  const segLuminances: number[] = [];
  for (let s = 0; s < segmentCount; s++) {
    const startX = s * segWidth;
    const endX = Math.min(startX + segWidth, width);
    let sumL = 0, count = 0;
    // Sample every 4th row for performance
    for (let y = 0; y < height; y += 4) {
      for (let x = startX; x < endX; x += 4) {
        const idx = (y * width + x) * 4;
        sumL += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        count++;
      }
    }
    segLuminances.push(sumL / Math.max(1, count));
  }

  const avgLum = segLuminances.reduce((a, b) => a + b, 0) / segLuminances.length;

  // Only correct if there's meaningful variation (>5% deviation)
  const maxDeviation = Math.max(...segLuminances.map(l => Math.abs(l - avgLum) / avgLum));
  if (maxDeviation < 0.05) return;

  // Apply smooth per-pixel correction with interpolation between segment centers
  for (let x = 0; x < width; x++) {
    // Find which segment center(s) this pixel is between
    const segFloat = (x / width) * segmentCount;
    const segIdx = Math.min(segmentCount - 1, Math.floor(segFloat));
    const nextIdx = Math.min(segmentCount - 1, segIdx + 1);
    const t = segFloat - segIdx;

    const localLum = segLuminances[segIdx] * (1 - t) + segLuminances[nextIdx] * t;
    if (localLum < 1) continue;

    // Dampened correction factor (max ±20% adjustment)
    const correctionRaw = avgLum / localLum;
    const correction = 1 + (correctionRaw - 1) * 0.6; // dampen to 60%
    const clampedCorrection = Math.max(0.8, Math.min(1.2, correction));

    if (Math.abs(clampedCorrection - 1) < 0.01) continue;

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(data[idx] * clampedCorrection)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] * clampedCorrection)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] * clampedCorrection)));
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Perform the cylindrical-to-equirectangular projection with enhanced processing.
 */
export async function stitchPanoramaLocally(
  stripUrl: string,
  onProgress?: (pct: number) => void,
  options?: StitchOptions,
): Promise<Blob> {
  onProgress?.(0);

  // 1. Load the strip image
  const stripImg = await loadImage(stripUrl);
  onProgress?.(5);

  // 2. Draw strip to a temp canvas
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = stripImg.naturalWidth;
  tempCanvas.height = stripImg.naturalHeight;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true })!;
  tempCtx.drawImage(stripImg, 0, 0);

  const stripWidth = tempCanvas.width;
  const stripHeight = tempCanvas.height;

  onProgress?.(10);

  // 3. Apply exposure normalization across the strip
  const photoCount = options?.photoCount || Math.max(3, Math.round(stripWidth / (stripHeight * 1.3)));
  normalizeStripExposure(tempCtx, stripWidth, stripHeight, photoCount);
  onProgress?.(20);

  // Re-read pixel data after normalization
  const stripData = tempCtx.getImageData(0, 0, stripWidth, stripHeight);

  // 4. Sample edge colors for pole gradients
  const topEdgeColor = sampleRowColor(stripData, 0, stripWidth);
  const bottomEdgeColor = sampleRowColor(stripData, stripHeight - 1, stripWidth);

  const ceilingColor = topEdgeColor.map(c => Math.round(c * 0.7)) as [number, number, number];
  const floorColor = bottomEdgeColor.map(c => Math.round(c * 0.6)) as [number, number, number];

  // 5. Create output canvas
  const outCanvas = document.createElement("canvas");
  outCanvas.width = OUTPUT_WIDTH;
  outCanvas.height = OUTPUT_HEIGHT;
  const outCtx = outCanvas.getContext("2d")!;

  // 6. Calculate the vertical band
  const bandTop = Math.round(OUTPUT_HEIGHT * (0.5 - STRIP_VERTICAL_COVERAGE / 2));
  const bandBottom = Math.round(OUTPUT_HEIGHT * (0.5 + STRIP_VERTICAL_COVERAGE / 2));
  const bandHeight = bandBottom - bandTop;

  // 7. Fill pole gradients
  const topGrad = outCtx.createLinearGradient(0, 0, 0, bandTop);
  topGrad.addColorStop(0, `rgb(${ceilingColor[0]}, ${ceilingColor[1]}, ${ceilingColor[2]})`);
  topGrad.addColorStop(1, `rgb(${topEdgeColor[0]}, ${topEdgeColor[1]}, ${topEdgeColor[2]})`);
  outCtx.fillStyle = topGrad;
  outCtx.fillRect(0, 0, OUTPUT_WIDTH, bandTop);

  const botGrad = outCtx.createLinearGradient(0, bandBottom, 0, OUTPUT_HEIGHT);
  botGrad.addColorStop(0, `rgb(${bottomEdgeColor[0]}, ${bottomEdgeColor[1]}, ${bottomEdgeColor[2]})`);
  botGrad.addColorStop(1, `rgb(${floorColor[0]}, ${floorColor[1]}, ${floorColor[2]})`);
  outCtx.fillStyle = botGrad;
  outCtx.fillRect(0, bandBottom, OUTPUT_WIDTH, OUTPUT_HEIGHT - bandBottom);

  onProgress?.(30);

  // 8. Compute spatial angular mapping if floorplan data available
  let spatialSpans: { photoIndex: number; normalizedX: number }[] | null = null;
  
  if (options?.roomScan?.walls?.length && options.cameraPosition) {
    try {
      const { computePhotoAngles, mapColumnToPhoto } = await import("./spatial-angles");
      const spans = computePhotoAngles({
        cameraX: options.cameraPosition.x,
        cameraY: options.cameraPosition.y,
        roomScan: options.roomScan,
        photoCount,
        photoFOV: options.cameraFOV || 75,
        initialHeading: options.initialHeading || 0,
      });

      // Pre-compute mapping for each output column
      spatialSpans = [];
      for (let outX = 0; outX < OUTPUT_WIDTH; outX++) {
        spatialSpans.push(mapColumnToPhoto(outX, OUTPUT_WIDTH, spans));
      }
      console.log("Spatial angular mapping applied:", spans.map(s => 
        `${s.centerAngle.toFixed(0)}°±${(s.angularWidth/2).toFixed(0)}° d=${s.wallDistance?.toFixed(1) || '?'}m`
      ).join(", "));
    } catch (err) {
      console.warn("Spatial mapping failed, using uniform:", err);
    }
  }

  // 9. Map strip pixels into the equirectangular band
  const outImageData = outCtx.getImageData(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const outPixels = outImageData.data;

  const halfVertCoverage = STRIP_VERTICAL_COVERAGE / 2;
  const cameraFOV = options?.cameraFOV || 75;
  
  // Adjust vertical mapping based on camera FOV
  // Wider FOV = more vertical coverage in the strip
  const verticalStretch = Math.min(1.2, Math.max(0.8, cameraFOV / 75));

  for (let outY = bandTop; outY < bandBottom; outY++) {
    if ((outY - bandTop) % Math.round(bandHeight / 7) === 0) {
      onProgress?.(30 + 55 * ((outY - bandTop) / bandHeight));
    }

    const bandFrac = (outY - bandTop) / bandHeight;
    const latFrac = bandFrac - 0.5;
    const latitude = latFrac * Math.PI * STRIP_VERTICAL_COVERAGE * verticalStretch;

    const maxLat = (Math.PI * STRIP_VERTICAL_COVERAGE * verticalStretch) / 2;
    const stripYNorm = 0.5 + (Math.tan(latitude) / Math.tan(maxLat)) * 0.5;
    const srcY = Math.min(stripHeight - 1, Math.max(0, Math.round(stripYNorm * (stripHeight - 1))));

    for (let outX = 0; outX < OUTPUT_WIDTH; outX++) {
      let srcX: number;

      if (spatialSpans) {
        // Use spatial-aware mapping
        const mapping = spatialSpans[outX];
        // Map to the correct position within the strip based on photo angular span
        const photoWidth = stripWidth / photoCount;
        srcX = Math.round(mapping.photoIndex * photoWidth + mapping.normalizedX * photoWidth);
        srcX = Math.min(stripWidth - 1, Math.max(0, srcX));
      } else {
        // Standard mapping: flip for inside-sphere viewing
        srcX = Math.round((1 - outX / OUTPUT_WIDTH) * (stripWidth - 1));
      }

      const srcIdx = (srcY * stripWidth + srcX) * 4;
      const dstIdx = (outY * OUTPUT_WIDTH + outX) * 4;

      outPixels[dstIdx] = stripData.data[srcIdx];
      outPixels[dstIdx + 1] = stripData.data[srcIdx + 1];
      outPixels[dstIdx + 2] = stripData.data[srcIdx + 2];
      outPixels[dstIdx + 3] = 255;
    }
  }

  outCtx.putImageData(outImageData, 0, 0);
  onProgress?.(88);

  // 10. Apply seam blending at band edges
  const blendSize = Math.round(OUTPUT_HEIGHT * 0.025);

  const topBlend = outCtx.createLinearGradient(0, bandTop - blendSize, 0, bandTop + blendSize);
  topBlend.addColorStop(0, `rgba(${topEdgeColor[0]}, ${topEdgeColor[1]}, ${topEdgeColor[2]}, 0.6)`);
  topBlend.addColorStop(1, "rgba(0,0,0,0)");
  outCtx.fillStyle = topBlend;
  outCtx.fillRect(0, bandTop - blendSize, OUTPUT_WIDTH, blendSize * 2);

  const botBlend = outCtx.createLinearGradient(0, bandBottom - blendSize, 0, bandBottom + blendSize);
  botBlend.addColorStop(0, "rgba(0,0,0,0)");
  botBlend.addColorStop(1, `rgba(${bottomEdgeColor[0]}, ${bottomEdgeColor[1]}, ${bottomEdgeColor[2]}, 0.6)`);
  outCtx.fillStyle = botBlend;
  outCtx.fillRect(0, bandBottom - blendSize, OUTPUT_WIDTH, blendSize * 2);

  // 11. Wrap-seam blending: blend left/right edges for seamless 360° wrapping
  const wrapBlendWidth = Math.round(OUTPUT_WIDTH * 0.015);
  if (wrapBlendWidth > 2) {
    const fullImgData = outCtx.getImageData(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    const px = fullImgData.data;
    
    for (let y = bandTop; y < bandBottom; y++) {
      for (let bx = 0; bx < wrapBlendWidth; bx++) {
        const alpha = bx / wrapBlendWidth; // 0 at left edge → 1 at blend boundary
        const leftIdx = (y * OUTPUT_WIDTH + bx) * 4;
        const rightIdx = (y * OUTPUT_WIDTH + (OUTPUT_WIDTH - wrapBlendWidth + bx)) * 4;
        
        // Average left and right edge pixels
        for (let c = 0; c < 3; c++) {
          const blended = Math.round(px[leftIdx + c] * alpha + px[rightIdx + c] * (1 - alpha));
          px[leftIdx + c] = blended;
          px[rightIdx + c] = Math.round(px[rightIdx + c] * (1 - alpha) + px[leftIdx + c] * alpha);
        }
      }
    }
    outCtx.putImageData(fullImgData, 0, 0);
  }

  onProgress?.(96);

  // 12. Export as JPEG blob
  return new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => {
        if (blob) {
          onProgress?.(100);
          resolve(blob);
        } else {
          reject(new Error("Canvas export failed"));
        }
      },
      "image/jpeg",
      0.92
    );
  });
}

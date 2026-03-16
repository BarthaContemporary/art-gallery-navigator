/**
 * Lens Distortion Correction
 * 
 * Applies barrel/pincushion distortion correction to wide-angle photos
 * using the Brown-Conrady radial distortion model.
 * 
 * Wide-angle lenses (FOV > 70°) produce barrel distortion where straight
 * lines curve outward. This correction maps distorted pixels back to
 * rectilinear positions.
 */

/**
 * Compute radial distortion coefficient from FOV.
 * Higher FOV → more barrel distortion.
 * These are empirical approximations for typical phone lenses.
 */
function estimateDistortionK(fovDegrees: number): number {
  // Lenses under 65° have negligible distortion
  if (fovDegrees <= 65) return 0;
  // Scale distortion roughly quadratically with FOV beyond 65°
  const excess = (fovDegrees - 65) / 100;
  // k1 coefficient — negative = barrel distortion to correct
  return -0.15 * excess * excess - 0.08 * excess;
}

/**
 * Apply radial undistortion to an image on a canvas.
 * Returns a new canvas with corrected pixels.
 * 
 * @param sourceCanvas - Canvas containing the distorted image
 * @param fovDegrees - Horizontal field of view in degrees
 * @param strength - Correction strength multiplier (1.0 = auto, >1 = stronger)
 */
export function undistortImage(
  sourceCanvas: HTMLCanvasElement,
  fovDegrees: number,
  strength: number = 1.0,
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true })!;
  const srcData = srcCtx.getImageData(0, 0, w, h);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d")!;
  const outData = outCtx.createImageData(w, h);

  const k1 = estimateDistortionK(fovDegrees) * strength;

  // No correction needed
  if (Math.abs(k1) < 0.001) {
    outCtx.drawImage(sourceCanvas, 0, 0);
    return outCanvas;
  }

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalized coordinates from center
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const r2 = dx * dx + dy * dy;

      // Brown-Conrady radial distortion: r_distorted = r * (1 + k1*r² + k2*r⁴)
      // We invert: given output (undistorted) pixel, find source (distorted) pixel
      const distortion = 1 + k1 * r2;
      const srcX = cx + dx * distortion * maxR;
      const srcY = cy + dy * distortion * maxR;

      // Bilinear interpolation
      const sx = Math.floor(srcX);
      const sy = Math.floor(srcY);
      const fx = srcX - sx;
      const fy = srcY - sy;

      if (sx < 0 || sx >= w - 1 || sy < 0 || sy >= h - 1) {
        // Outside bounds — fill with edge color
        const clampX = Math.max(0, Math.min(w - 1, Math.round(srcX)));
        const clampY = Math.max(0, Math.min(h - 1, Math.round(srcY)));
        const ci = (clampY * w + clampX) * 4;
        const oi = (y * w + x) * 4;
        outData.data[oi] = srcData.data[ci];
        outData.data[oi + 1] = srcData.data[ci + 1];
        outData.data[oi + 2] = srcData.data[ci + 2];
        outData.data[oi + 3] = 255;
        continue;
      }

      const i00 = (sy * w + sx) * 4;
      const i10 = i00 + 4;
      const i01 = ((sy + 1) * w + sx) * 4;
      const i11 = i01 + 4;
      const oi = (y * w + x) * 4;

      for (let c = 0; c < 3; c++) {
        outData.data[oi + c] = Math.round(
          srcData.data[i00 + c] * (1 - fx) * (1 - fy) +
          srcData.data[i10 + c] * fx * (1 - fy) +
          srcData.data[i01 + c] * (1 - fx) * fy +
          srcData.data[i11 + c] * fx * fy,
        );
      }
      outData.data[oi + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

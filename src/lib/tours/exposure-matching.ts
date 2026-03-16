/**
 * Exposure Matching & Multi-Band Blending
 * 
 * 1. Histogram equalization: normalizes brightness across images
 * 2. Multi-band blending: Laplacian pyramid-inspired smooth transitions
 */

interface ImageStats {
  meanR: number;
  meanG: number;
  meanB: number;
  meanLuminance: number;
  stdLuminance: number;
}

/**
 * Compute per-channel mean and luminance statistics for an image.
 */
function computeStats(canvas: HTMLCanvasElement): ImageStats {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height;

  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumL2 = 0;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sumL += lum;
    sumL2 += lum * lum;
  }

  const meanR = sumR / n;
  const meanG = sumG / n;
  const meanB = sumB / n;
  const meanL = sumL / n;
  const stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));

  return { meanR, meanG, meanB, meanLuminance: meanL, stdLuminance: stdL };
}

/**
 * Match the exposure of a source canvas to a reference canvas.
 * Uses per-channel mean matching with luminance standard deviation scaling.
 * Modifies the source canvas in-place.
 */
export function matchExposure(
  sourceCanvas: HTMLCanvasElement,
  referenceStats: ImageStats,
): void {
  const srcStats = computeStats(sourceCanvas);
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = imgData.data;

  // Per-channel gain and offset
  const scaleR = referenceStats.meanR / Math.max(1, srcStats.meanR);
  const scaleG = referenceStats.meanG / Math.max(1, srcStats.meanG);
  const scaleB = referenceStats.meanB / Math.max(1, srcStats.meanB);

  // Luminance contrast matching
  const lumScale = srcStats.stdLuminance > 0
    ? referenceStats.stdLuminance / srcStats.stdLuminance
    : 1;

  // Blend between per-channel and luminance-based correction (70/30)
  const channelWeight = 0.7;
  const lumWeight = 0.3;

  for (let i = 0; i < data.length; i += 4) {
    const origR = data[i];
    const origG = data[i + 1];
    const origB = data[i + 2];

    // Per-channel correction
    const chR = origR * scaleR;
    const chG = origG * scaleG;
    const chB = origB * scaleB;

    // Luminance-based correction
    const lum = 0.299 * origR + 0.587 * origG + 0.114 * origB;
    const adjLum = referenceStats.meanLuminance + (lum - srcStats.meanLuminance) * lumScale;
    const lumRatio = lum > 0 ? adjLum / lum : 1;
    const lumR = origR * lumRatio;
    const lumG = origG * lumRatio;
    const lumB = origB * lumRatio;

    // Blend
    data[i] = Math.max(0, Math.min(255, Math.round(chR * channelWeight + lumR * lumWeight)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(chG * channelWeight + lumG * lumWeight)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(chB * channelWeight + lumB * lumWeight)));
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Compute stats for a canvas — exported for use as reference.
 */
export function getImageStats(canvas: HTMLCanvasElement): ImageStats {
  return computeStats(canvas);
}

/**
 * Multi-band blend two overlapping canvases.
 * Uses a simplified 3-level Gaussian/Laplacian pyramid approach
 * to smoothly blend exposure differences across the seam.
 * 
 * @param leftCanvas - Left image in overlap region
 * @param rightCanvas - Right image in overlap region  
 * @param overlapWidth - Width of the overlap in pixels
 * @returns Blended canvas of the overlap region
 */
export function multiBandBlend(
  leftCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  overlapWidth: number,
  height: number,
): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = overlapWidth;
  result.height = height;
  const ctx = result.getContext("2d")!;

  // Get pixel data from both sides
  const leftCtx = leftCanvas.getContext("2d", { willReadFrequently: true })!;
  const rightCtx = rightCanvas.getContext("2d", { willReadFrequently: true })!;

  const leftData = leftCtx.getImageData(
    leftCanvas.width - overlapWidth, 0, overlapWidth, height,
  );
  const rightData = rightCtx.getImageData(0, 0, overlapWidth, height);
  const outData = ctx.createImageData(overlapWidth, height);

  // 3-level pyramid blend weights
  // Level 0: sharp transition at center (high frequency detail)
  // Level 1: gradual transition (mid frequency)
  // Level 2: very gradual (low frequency / exposure)
  const levels = 3;
  const sigmas = [overlapWidth * 0.05, overlapWidth * 0.15, overlapWidth * 0.4];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < overlapWidth; x++) {
      const idx = (y * overlapWidth + x) * 4;

      // Compute multi-band alpha
      // Base linear blend
      const t = x / Math.max(1, overlapWidth - 1);

      // Smooth sigmoid-like blend for each band
      let alpha = 0;
      for (let l = 0; l < levels; l++) {
        const sigma = sigmas[l];
        const center = overlapWidth / 2;
        const bandAlpha = 1 / (1 + Math.exp(-(x - center) / Math.max(1, sigma)));
        alpha += bandAlpha / levels;
      }

      // Clamp
      alpha = Math.max(0, Math.min(1, alpha));

      for (let c = 0; c < 3; c++) {
        outData.data[idx + c] = Math.round(
          leftData.data[idx + c] * (1 - alpha) +
          rightData.data[idx + c] * alpha,
        );
      }
      outData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(outData, 0, 0);
  return result;
}

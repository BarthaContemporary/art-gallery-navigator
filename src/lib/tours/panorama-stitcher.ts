/**
 * Client-side Panorama Stitcher
 * 
 * Converts a cylindrical panorama strip into an equirectangular projection
 * suitable for spherical 360° viewing — using pure geometry, no AI.
 * 
 * The strip covers 360° horizontally but only a vertical band (~60% of the sphere).
 * This utility:
 * 1. Loads the strip onto a canvas
 * 2. Creates a 2:1 equirectangular output (4096×2048)
 * 3. Maps the strip into the middle band with cylindrical→equirectangular correction
 * 4. Fills top/bottom poles with smooth gradients sampled from strip edges
 * 5. Exports as a high-quality JPEG blob
 */

const OUTPUT_WIDTH = 4096;
const OUTPUT_HEIGHT = 2048;

// The strip covers roughly this fraction of the vertical FOV (latitude range)
// Typical phone captures at ~60° vertical FOV → ~33% of full 180° latitude range
// We map the strip to the middle portion and gradient-fill the poles
const STRIP_VERTICAL_COVERAGE = 0.38; // fraction of output height the strip occupies

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
  // Sample every 8th pixel for performance
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
 * Perform the cylindrical-to-equirectangular projection and pole filling.
 */
export async function stitchPanoramaLocally(
  stripUrl: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(0);

  // 1. Load the strip image
  const stripImg = await loadImage(stripUrl);
  onProgress?.(10);

  // 2. Draw strip to a temp canvas to get pixel data
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = stripImg.naturalWidth;
  tempCanvas.height = stripImg.naturalHeight;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true })!;
  tempCtx.drawImage(stripImg, 0, 0);

  const stripWidth = tempCanvas.width;
  const stripHeight = tempCanvas.height;
  const stripData = tempCtx.getImageData(0, 0, stripWidth, stripHeight);

  onProgress?.(20);

  // 3. Sample edge colors for pole gradients
  const topEdgeColor = sampleRowColor(stripData, 0, stripWidth);
  const bottomEdgeColor = sampleRowColor(stripData, stripHeight - 1, stripWidth);

  // Darken pole colors slightly for a natural look
  const ceilingColor = topEdgeColor.map(c => Math.round(c * 0.7)) as [number, number, number];
  const floorColor = bottomEdgeColor.map(c => Math.round(c * 0.6)) as [number, number, number];

  // 4. Create output canvas
  const outCanvas = document.createElement("canvas");
  outCanvas.width = OUTPUT_WIDTH;
  outCanvas.height = OUTPUT_HEIGHT;
  const outCtx = outCanvas.getContext("2d")!;

  // 5. Calculate the vertical band where the strip maps to
  const bandTop = Math.round(OUTPUT_HEIGHT * (0.5 - STRIP_VERTICAL_COVERAGE / 2));
  const bandBottom = Math.round(OUTPUT_HEIGHT * (0.5 + STRIP_VERTICAL_COVERAGE / 2));
  const bandHeight = bandBottom - bandTop;

  // 6. Fill entire canvas with gradient from ceiling → strip top edge → strip bottom edge → floor
  // Top pole gradient
  const topGrad = outCtx.createLinearGradient(0, 0, 0, bandTop);
  topGrad.addColorStop(0, `rgb(${ceilingColor[0]}, ${ceilingColor[1]}, ${ceilingColor[2]})`);
  topGrad.addColorStop(1, `rgb(${topEdgeColor[0]}, ${topEdgeColor[1]}, ${topEdgeColor[2]})`);
  outCtx.fillStyle = topGrad;
  outCtx.fillRect(0, 0, OUTPUT_WIDTH, bandTop);

  // Bottom pole gradient
  const botGrad = outCtx.createLinearGradient(0, bandBottom, 0, OUTPUT_HEIGHT);
  botGrad.addColorStop(0, `rgb(${bottomEdgeColor[0]}, ${bottomEdgeColor[1]}, ${bottomEdgeColor[2]})`);
  botGrad.addColorStop(1, `rgb(${floorColor[0]}, ${floorColor[1]}, ${floorColor[2]})`);
  outCtx.fillStyle = botGrad;
  outCtx.fillRect(0, bandBottom, OUTPUT_WIDTH, OUTPUT_HEIGHT - bandBottom);

  onProgress?.(30);

  // 7. Map strip pixels into the equirectangular band
  // For performance, draw in horizontal slices using drawImage scaling
  // The cylindrical→equirectangular warp is minimal for the middle band,
  // so we use a slice-by-slice approach with latitude-based compression

  // Use pixel-level remapping for accuracy via ImageData
  const outImageData = outCtx.getImageData(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const outPixels = outImageData.data;

  const halfVertCoverage = STRIP_VERTICAL_COVERAGE / 2;

  for (let outY = bandTop; outY < bandBottom; outY++) {
    // Progress update every ~10% of band
    if ((outY - bandTop) % Math.round(bandHeight / 7) === 0) {
      onProgress?.(30 + 60 * ((outY - bandTop) / bandHeight));
    }

    // Normalized position within the band: 0 (top of band) → 1 (bottom of band)
    const bandFrac = (outY - bandTop) / bandHeight;

    // Convert to latitude: map band to ±halfVertCoverage of π
    // Center of band = equator (latitude 0)
    const latFrac = bandFrac - 0.5; // -0.5 to +0.5
    const latitude = latFrac * Math.PI * STRIP_VERTICAL_COVERAGE;

    // Cylindrical correction: in equirectangular, vertical spacing is uniform in latitude,
    // but in a cylindrical photo the vertical scale is constant.
    // Map back: stripY = stripHeight * (0.5 + tan(latitude) / tan(maxLat))
    // For small angles this is nearly linear, but provides proper correction at edges.
    const maxLat = (Math.PI * STRIP_VERTICAL_COVERAGE) / 2;
    const stripYNorm = 0.5 + (Math.tan(latitude) / Math.tan(maxLat)) * 0.5;
    const srcY = Math.min(stripHeight - 1, Math.max(0, Math.round(stripYNorm * (stripHeight - 1))));

    for (let outX = 0; outX < OUTPUT_WIDTH; outX++) {
      // Horizontal mapping is straightforward: linear longitude
      const srcX = Math.round((outX / OUTPUT_WIDTH) * (stripWidth - 1));

      const srcIdx = (srcY * stripWidth + srcX) * 4;
      const dstIdx = (outY * OUTPUT_WIDTH + outX) * 4;

      outPixels[dstIdx] = stripData.data[srcIdx];
      outPixels[dstIdx + 1] = stripData.data[srcIdx + 1];
      outPixels[dstIdx + 2] = stripData.data[srcIdx + 2];
      outPixels[dstIdx + 3] = 255;
    }
  }

  outCtx.putImageData(outImageData, 0, 0);
  onProgress?.(92);

  // 8. Apply a subtle vertical blur at the band edges to blend with gradients
  // We do this by drawing semi-transparent gradient overlays at the seams
  const blendSize = Math.round(OUTPUT_HEIGHT * 0.02);

  // Top seam blend
  const topBlend = outCtx.createLinearGradient(0, bandTop - blendSize, 0, bandTop + blendSize);
  topBlend.addColorStop(0, `rgba(${topEdgeColor[0]}, ${topEdgeColor[1]}, ${topEdgeColor[2]}, 0.6)`);
  topBlend.addColorStop(1, "rgba(0,0,0,0)");
  outCtx.fillStyle = topBlend;
  outCtx.fillRect(0, bandTop - blendSize, OUTPUT_WIDTH, blendSize * 2);

  // Bottom seam blend
  const botBlend = outCtx.createLinearGradient(0, bandBottom - blendSize, 0, bandBottom + blendSize);
  botBlend.addColorStop(0, "rgba(0,0,0,0)");
  botBlend.addColorStop(1, `rgba(${bottomEdgeColor[0]}, ${bottomEdgeColor[1]}, ${bottomEdgeColor[2]}, 0.6)`);
  outCtx.fillStyle = botBlend;
  outCtx.fillRect(0, bandBottom - blendSize, OUTPUT_WIDTH, blendSize * 2);

  onProgress?.(96);

  // 9. Export as JPEG blob
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

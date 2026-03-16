/**
 * EXIF Extraction Utilities
 * 
 * Extracts camera metadata (focal length, sensor size, FOV) from images
 * using the exifr library.
 */
import exifr from "exifr";

export interface CameraMetadata {
  focalLength: number | null;       // mm
  focalLength35mm: number | null;   // 35mm equivalent
  sensorWidth: number | null;       // mm (estimated from crop factor)
  horizontalFOV: number;            // degrees — estimated or calculated
  verticalFOV: number;              // degrees
  make: string | null;
  model: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

// Common phone sensor widths (mm) by manufacturer
const SENSOR_ESTIMATES: Record<string, number> = {
  apple: 6.17,      // iPhone main sensor ~1/1.65"
  samsung: 6.4,     // Galaxy S series ~1/1.56"
  google: 6.17,     // Pixel
  huawei: 6.17,
  xiaomi: 6.17,
  sony: 7.82,       // Xperia 1" sensor
  default: 6.17,    // conservative phone estimate
};

function estimateSensorWidth(make: string | null): number {
  if (!make) return SENSOR_ESTIMATES.default;
  const lower = make.toLowerCase();
  for (const [key, val] of Object.entries(SENSOR_ESTIMATES)) {
    if (lower.includes(key)) return val;
  }
  return SENSOR_ESTIMATES.default;
}

/**
 * Calculate horizontal FOV from focal length and sensor width
 * FOV = 2 * atan(sensorWidth / (2 * focalLength))
 */
function calcFOV(focalLength: number, sensorDim: number): number {
  return 2 * Math.atan(sensorDim / (2 * focalLength)) * (180 / Math.PI);
}

/**
 * Extract camera metadata from a File or URL.
 * Returns estimated FOV even if EXIF is missing.
 */
export async function extractCameraMetadata(
  source: File | string,
): Promise<CameraMetadata> {
  const defaults: CameraMetadata = {
    focalLength: null,
    focalLength35mm: null,
    sensorWidth: null,
    horizontalFOV: 75,   // reasonable default for phone wide-angle
    verticalFOV: 55,
    make: null,
    model: null,
    imageWidth: null,
    imageHeight: null,
  };

  try {
    const exif = await exifr.parse(source, {
      pick: [
        "FocalLength",
        "FocalLengthIn35mmFormat",
        "Make",
        "Model",
        "ImageWidth",
        "ImageLength",
        "ExifImageWidth",
        "ExifImageHeight",
        "PixelXDimension",
        "PixelYDimension",
      ],
    });

    if (!exif) return defaults;

    const make = exif.Make || exif.make || null;
    const model = exif.Model || exif.model || null;
    const focalLength = exif.FocalLength || exif.focalLength || null;
    const focalLength35mm =
      exif.FocalLengthIn35mmFormat || exif.FocalLengthIn35mmFilm || null;
    const imgW =
      exif.ExifImageWidth || exif.PixelXDimension || exif.ImageWidth || null;
    const imgH =
      exif.ExifImageHeight || exif.PixelYDimension || exif.ImageLength || null;

    let horizontalFOV = defaults.horizontalFOV;
    let verticalFOV = defaults.verticalFOV;
    let sensorWidth: number | null = null;

    if (focalLength35mm) {
      // 35mm equivalent is the most reliable — full-frame sensor is 36×24mm
      horizontalFOV = calcFOV(focalLength35mm, 36);
      verticalFOV = calcFOV(focalLength35mm, 24);
      sensorWidth = 36; // full-frame reference
    } else if (focalLength) {
      // Estimate sensor size from manufacturer
      sensorWidth = estimateSensorWidth(make);
      const sensorHeight = sensorWidth * (imgH && imgW ? imgH / imgW : 0.75);
      horizontalFOV = calcFOV(focalLength, sensorWidth);
      verticalFOV = calcFOV(focalLength, sensorHeight);
    }

    // Clamp to reasonable values
    horizontalFOV = Math.max(30, Math.min(180, horizontalFOV));
    verticalFOV = Math.max(20, Math.min(140, verticalFOV));

    return {
      focalLength,
      focalLength35mm,
      sensorWidth,
      horizontalFOV,
      verticalFOV,
      make,
      model,
      imageWidth: imgW,
      imageHeight: imgH,
    };
  } catch (err) {
    console.warn("EXIF extraction failed:", err);
    return defaults;
  }
}

/**
 * Quick FOV extraction — returns just the horizontal FOV in degrees.
 */
export async function extractFOV(source: File | string): Promise<number> {
  const meta = await extractCameraMetadata(source);
  return meta.horizontalFOV;
}

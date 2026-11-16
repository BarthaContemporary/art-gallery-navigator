import sharp from "sharp";

export interface MasterOptions {
  /** Manual quarter-turns set in the studio (0/90/180/270). */
  rotation: number;
  /** Longest side of the master; never enlarged. */
  maxDimension: number;
  /** Decompression-bomb ceiling on decoded pixels. */
  maxInputPixels: number;
  quality: number;
}

/**
 * The sRGB JPEG display master of an original.
 *
 * autoOrient() rather than a bare rotate(): chaining rotate().rotate(n) is
 * ambiguous — sharp documents that the last rotate wins, so whether the EXIF
 * orientation survives depends on the angle. autoOrient() applies EXIF
 * orientation explicitly and composes cleanly with a following rotate(),
 * which re-applies a turn a person set by hand in the studio.
 *
 * flatten() puts a transparent background (a cut-out PNG, WebP or TIFF) on
 * white: JPEG has no alpha, and without it libvips dropped it to black. It
 * changes nothing in an image without alpha. toColorspace('srgb') normalises
 * AdobeRGB / ProPhoto / CMYK originals.
 */
export function displayMaster(buf: Buffer, o: MasterOptions) {
  return sharp(buf, { limitInputPixels: o.maxInputPixels })
    .autoOrient()
    .rotate(o.rotation)
    .flatten({ background: "#ffffff" })
    .toColorspace("srgb")
    .resize({ width: o.maxDimension, height: o.maxDimension, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: o.quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
}

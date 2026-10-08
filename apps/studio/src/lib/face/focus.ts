import sharp from "sharp";
import { FACEFINDER_BASE64 } from "./facefinder";
import { clusterDetections, runCascade, unpackCascade, type Classifier } from "./pico";

/**
 * Where a portrait's face is, as fractions of the image (0..1 from the top
 * left), so a square crop can be centred on it. `width`/`height` are the
 * face box as fractions of the image. `method` says whether a face was
 * found or the frame fell back to the upper centre, where most portraits
 * keep the head anyway.
 */
export type PortraitFocus = {
  x: number;
  y: number;
  width: number;
  height: number;
  method: "face" | "fallback";
  score: number;
  detectedAt: string;
};

const FALLBACK: Omit<PortraitFocus, "detectedAt"> = { x: 0.5, y: 0.42, width: 0.5, height: 0.5, method: "fallback", score: 0 };
const WORK_PX = 800; // detection runs on a copy no larger than this
const MIN_SCORE = 5; // pico's own usual threshold for "this is a face"

let classifier: Classifier | null = null;
const getClassifier = () => (classifier ??= unpackCascade(new Uint8Array(Buffer.from(FACEFINDER_BASE64, "base64"))));

/** Find the most confident face in an image buffer (any format sharp reads). */
export async function detectPortraitFocus(input: Buffer): Promise<PortraitFocus> {
  const detectedAt = new Date().toISOString();
  // metadata() reports the stored dimensions; after rotate() an EXIF
  // orientation of 5 to 8 swaps them, and the working copy must match.
  const meta = await sharp(input).metadata();
  const swapped = (meta.orientation ?? 1) >= 5;
  const W = (swapped ? meta.height : meta.width) ?? 0;
  const H = (swapped ? meta.width : meta.height) ?? 0;
  if (!W || !H) return { ...FALLBACK, detectedAt };
  const scale = Math.min(1, WORK_PX / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const { data } = await sharp(input).rotate().grayscale().resize(w, h, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const image = { pixels: new Uint8Array(data.buffer, data.byteOffset, data.length), nrows: h, ncols: w, ldim: w };
  const minDim = Math.min(w, h);
  const raw = runCascade(image, getClassifier(), {
    shiftfactor: 0.1,
    minsize: Math.max(16, Math.round(minDim * 0.12)),
    maxsize: Math.round(minDim * 1.2),
    scalefactor: 1.1,
  });
  const faces = clusterDetections(raw, 0.2)
    .filter((d) => d[3] > MIN_SCORE)
    .sort((a, b) => b[3] - a[3]);
  if (faces.length === 0) return { ...FALLBACK, detectedAt };
  const [row, col, size, score] = faces[0]!;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x: +clamp(col / w).toFixed(4),
    y: +clamp(row / h).toFixed(4),
    width: +clamp(size / w).toFixed(4),
    height: +clamp(size / h).toFixed(4),
    method: "face",
    score: +score.toFixed(1),
    detectedAt,
  };
}

/**
 * The Sanity image fields that make the CDN frame a crop on the face:
 * `crop=focalpoint&fp-x&fp-y` reads the hotspot, and the Studio's hotspot
 * tool shows the same box. Returns nothing for a fallback so the CDN's own
 * centre crop applies.
 */
export function sanityFraming(focus: PortraitFocus | null | undefined) {
  if (!focus) return {};
  const width = Math.min(focus.width, 2 * Math.min(focus.x, 1 - focus.x));
  const height = Math.min(focus.height, 2 * Math.min(focus.y, 1 - focus.y));
  return {
    hotspot: { _type: "sanity.imageHotspot", x: focus.x, y: focus.y, width: Math.max(0.05, width), height: Math.max(0.05, height) },
    crop: { _type: "sanity.imageCrop", top: 0, bottom: 0, left: 0, right: 0 },
  };
}

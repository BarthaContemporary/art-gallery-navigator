"use client";

export type Geo = { rotate_deg: number; crop: { x: number; y: number; w: number; h: number } };

/**
 * Square up a photographed page: rotate it upright (Claude-supplied angle) and
 * crop to the paper. Runs on a canvas in the browser — no server image lib.
 * Returns a JPEG File, or null if anything goes wrong (caller keeps original).
 */
export async function squareUp(file: File, geo: Geo): Promise<File | null> {
  try {
    const img = await loadImage(file);
    const rot = ((geo.rotate_deg % 360) + 360) % 360;
    const rad = (rot * Math.PI) / 180;

    // 1. Rotate the whole image onto a canvas sized to the rotated bounds.
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rw = Math.round(sw * cos + sh * sin);
    const rh = Math.round(sw * sin + sh * cos);

    const rc = document.createElement("canvas");
    rc.width = rw;
    rc.height = rh;
    const rctx = rc.getContext("2d");
    if (!rctx) return null;
    rctx.translate(rw / 2, rh / 2);
    rctx.rotate(rad);
    rctx.drawImage(img, -sw / 2, -sh / 2);

    // 2. Crop to the paper box (fractions of the rotated image).
    const crop = sanitiseCrop(geo.crop);
    const cx = Math.round(crop.x * rw);
    const cy = Math.round(crop.y * rh);
    const cwv = Math.max(1, Math.round(crop.w * rw));
    const chv = Math.max(1, Math.round(crop.h * rh));

    const oc = document.createElement("canvas");
    oc.width = cwv;
    oc.height = chv;
    const octx = oc.getContext("2d");
    if (!octx) return null;
    octx.drawImage(rc, cx, cy, cwv, chv, 0, 0, cwv, chv);

    const blob = await new Promise<Blob | null>((resolve) => oc.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.\w+$/, "") + "-squared.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

function sanitiseCrop(c: Geo["crop"]): Geo["crop"] {
  const x = clamp(c?.x ?? 0);
  const y = clamp(c?.y ?? 0);
  const w = clamp(c?.w ?? 1);
  const h = clamp(c?.h ?? 1);
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}
const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

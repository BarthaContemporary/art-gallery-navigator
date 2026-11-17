"use client";

import { createClient } from "@jvb/db/browser";
import { jsonBody, requestJson } from "@/lib/request";

let client: ReturnType<typeof createClient> | null = null;

/** Singleton browser Supabase client (used only for direct-to-storage uploads). */
export function supabaseBrowser() {
  if (!client) client = createClient();
  return client;
}

export const CAPTURES_BUCKET = "captures";

/**
 * Upload a File straight to the private `captures` bucket, bypassing the
 * Next.js request-body limit. The server hands us a one-time signed upload
 * URL; the browser PUTs the bytes directly to storage. Throws with a message
 * a person can act on (signed out, no connection, the server's error).
 */
export async function uploadToCaptures(
  file: File,
  purpose: "work" | "invoice" | "card",
  ids: { batchId?: string; workId?: string; invoiceId?: string } = {},
): Promise<{ path: string; width: number; height: number }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const { path, token } = await requestJson<{ path?: string; token?: string }>(
    "/api/capture/upload",
    jsonBody("POST", { purpose, ext, ...ids }),
  );
  if (!path || !token) throw new Error("Could not start the upload. Try again.");

  const { error } = await supabaseBrowser()
    .storage.from(CAPTURES_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || "image/jpeg" });
  if (error) throw new Error(`The photo did not upload (${error.message}). Try again.`);

  const dims = await imageDimensions(file).catch(() => ({ width: 0, height: 0 }));
  return { path, ...dims };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  return loadImage(url)
    .then((img) => ({ width: img.naturalWidth, height: img.naturalHeight }))
    .finally(() => URL.revokeObjectURL(url));
}

/**
 * A small JPEG preview of a photo, as an object URL, for a thumbnail tile: a
 * phone photo is 12-24 megapixels, and a screen full of them decoded at full
 * size can make a phone's browser reload the page. The shorter side becomes
 * `side` pixels. If the photo cannot be drawn, the photo's own object URL is
 * returned instead. Either way the caller revokes the URL when the tile goes.
 */
export async function makeThumbnail(file: Blob, side = 320): Promise<string> {
  const original = URL.createObjectURL(file);
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, side / Math.max(1, Math.min(img.naturalWidth, img.naturalHeight)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (!blob) return original;
    URL.revokeObjectURL(original);
    return URL.createObjectURL(blob);
  } catch {
    return original;
  }
}

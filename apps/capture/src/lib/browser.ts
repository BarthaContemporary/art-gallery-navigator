"use client";

import { createClient } from "@jvb/db/browser";

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
 * URL; the browser PUTs the bytes directly to storage.
 */
export async function uploadToCaptures(
  file: File,
  purpose: "work" | "invoice" | "card",
  ids: { batchId?: string; workId?: string; invoiceId?: string } = {},
): Promise<{ path: string; width: number; height: number }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const res = await fetch("/api/capture/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose, ext, ...ids }),
  });
  if (!res.ok) throw new Error("Could not start upload");
  const { path, token } = (await res.json()) as { path: string; token: string };

  const { error } = await supabaseBrowser()
    .storage.from(CAPTURES_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);

  const dims = await imageDimensions(file).catch(() => ({ width: 0, height: 0 }));
  return { path, ...dims };
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

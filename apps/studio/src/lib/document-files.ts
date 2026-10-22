/**
 * Browser-side helpers for files in the documents bucket (shipment files,
 * piece documents, the shared Documents area — all live in one bucket; the
 * sign route decides the paths). One place for the bucket name, the signing
 * call and the "can the browser show this?" decision.
 */

// The browser Supabase client is loaded when a document link is first signed,
// not with the page that imports this module (about 70 kB of first-load JS).
const browserClient = () => import("@jvb/db/browser").then((m) => m.createClient());

export const DOCUMENTS_BUCKET = "piece-documents";

export type PreviewKind = "image" | "pdf" | "other";

/**
 * Mirrors the extension allowlist in api/files/sign/route.ts: only these can
 * exist in the bucket. TIFF/HEIC are listed as images because Safari renders
 * them; other browsers fall back via the <img> onError path (and the imgproxy
 * transform below decodes them anyway).
 */
export function previewKind(path: string): PreviewKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "tif", "tiff", "heic", "heif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export async function signDocumentUrl(
  storagePath: string,
  ttlSeconds: number,
  transform?: { width?: number; height?: number; quality?: number },
): Promise<string> {
  const supabase = await browserClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds, transform ? { transform } : undefined);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "could not sign file URL");
  return data.signedUrl;
}

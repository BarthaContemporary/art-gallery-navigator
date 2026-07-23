import { NextResponse } from "next/server";
import sharp from "sharp";
import convert from "heic-convert";
import { getSession, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// sharp on a full-size original can take a moment.
export const maxDuration = 60;

const MAX_BYTES = 30 * 1024 * 1024;
const DISPLAY_MAX_PX = 2560;

/**
 * Upload / replace a maker's representative portrait — same treatment as the
 * main image pipeline, done inline:
 *   - the untouched original is kept (portrait_original_path) for
 *     high-resolution export documents;
 *   - an sRGB JPEG display master (max 2560px, auto-rotated) is generated
 *     for the studio and the website (portrait_path);
 *   - iPhone HEIC uploads are decoded via heic-convert when sharp's libvips
 *     can't read them.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name))
    return NextResponse.json({ error: "Not an image" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Image too large (max 30MB)" }, { status: 400 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("id, portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const original = Buffer.from(await file.arrayBuffer());

  // Display master: auto-rotate, normalise to sRGB, cap the long edge.
  const toMaster = (buf: Buffer) =>
    sharp(buf, { limitInputPixels: 1_000_000_000 })
      .rotate()
      .toColorspace("srgb")
      .resize({ width: DISPLAY_MAX_PX, height: DISPLAY_MAX_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

  let display: Buffer;
  try {
    display = await toMaster(original);
  } catch {
    try {
      const converted = (await convert({
        buffer: original,
        format: "JPEG",
        quality: 0.95,
      })) as unknown as Uint8Array;
      display = await toMaster(Buffer.from(converted));
    } catch {
      return NextResponse.json(
        { error: "Could not read this image format — try JPEG, PNG, TIFF or HEIC" },
        { status: 400 },
      );
    }
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const stamp = Date.now(); // versioned names bust any signed-URL caching
  const originalPath = `${id}/original-${stamp}.${ext}`;
  const displayPath = `${id}/display-${stamp}.jpg`;

  const bucket = svc.storage.from("maker-portraits");
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    bucket.upload(originalPath, original, { contentType: file.type || "application/octet-stream", upsert: true }),
    bucket.upload(displayPath, display, { contentType: "image/jpeg", upsert: true }),
  ]);
  if (e1 || e2)
    return NextResponse.json({ error: (e1 ?? e2)?.message ?? "Upload failed" }, { status: 500 });

  // Point the maker at the new pair, then clear out the previous files.
  await svc
    .from("makers")
    .update({ portrait_path: displayPath, portrait_original_path: originalPath })
    .eq("id", id);
  const stale = [maker.portrait_path, maker.portrait_original_path].filter(
    (p): p is string => !!p && p !== displayPath && p !== originalPath,
  );
  if (stale.length) await bucket.remove(stale);

  const { data: signed } = await bucket.createSignedUrl(displayPath, 3600);
  return NextResponse.json({ ok: true, path: displayPath, url: signed?.signedUrl ?? null });
}

/** Remove the portrait (both the display version and the original). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const paths = [maker.portrait_path, maker.portrait_original_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length) await svc.storage.from("maker-portraits").remove(paths);
  await svc
    .from("makers")
    .update({ portrait_path: null, portrait_original_path: null })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabase, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DERIVATIVES_BUCKET = "piece-derivatives";
// Match the image worker so a rotated derivative is indistinguishable from a
// freshly processed one (infra/image-worker/src/worker.ts).
const JPEG_QUALITY = 85;

/**
 * Rotate an image's display master 90° counter-clockwise, in place.
 *
 * Only the derivative is rotated — the archival original is never rewritten, so
 * nothing is lost to repeated re-encoding. The cumulative angle is recorded on
 * `piece_images.rotation` so a future re-derivation can re-apply it rather than
 * silently reverting the correction.
 *
 * One re-encode per press. Four presses return to the start, having re-encoded
 * four times; at quality 85 that is visually harmless, and the original remains
 * the source of truth for anything that matters.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth against the caller's session…
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: img, error: readErr } = await supabase
    .from("piece_images")
    .select("id, piece_id, storage_path_display, rotation")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!img) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  if (!img.storage_path_display) {
    return NextResponse.json(
      { error: "This image has no processed version to rotate yet." },
      { status: 409 },
    );
  }

  // …but read/write the derivatives bucket with the service client: it carries
  // no public policies, exactly as the page's own signed-URL reads do.
  const admin = createServiceClient();

  const { data: file, error: dlErr } = await admin.storage
    .from(DERIVATIVES_BUCKET)
    .download(img.storage_path_display);
  if (dlErr || !file) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Could not read the image" },
      { status: 500 },
    );
  }

  let rotated: Buffer;
  let info: { width: number; height: number; size: number };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // Negative angle = counter-clockwise. The derivative was already
    // EXIF-oriented by the worker, so this is a plain pixel rotation.
    const out = await sharp(input)
      .rotate(-90)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    rotated = out.data;
    info = { width: out.info.width, height: out.info.height, size: out.info.size };
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not rotate the image" },
      { status: 500 },
    );
  }

  const { error: upErr } = await admin.storage
    .from(DERIVATIVES_BUCKET)
    .upload(img.storage_path_display, rotated, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 90° counter-clockwise === 270° clockwise, kept in the 0/90/180/270 domain
  // the column's check constraint allows.
  const nextRotation = (((img.rotation ?? 0) + 270) % 360) as 0 | 90 | 180 | 270;

  const { error: updErr } = await admin
    .from("piece_images")
    .update({
      rotation: nextRotation,
      width: info.width,
      height: info.height,
      file_size_bytes: info.size,
    })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    rotation: nextRotation,
    width: info.width,
    height: info.height,
  });
}

import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabase, getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { pieceDisplayPath } from "@/lib/storage-paths";

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
 *
 * File and row must agree, because the worker re-applies `rotation` whenever
 * it re-derives a master. So: no rotation while the worker has the row
 * (pending or processing, 409); the file is written first, then the row,
 * on condition that its rotation is still the one this request started from;
 * a row write that fails puts the old file back; and a row that someone
 * else rotated meanwhile is handed back to the worker to rebuild from the
 * original at the recorded angle (409).
 *
 * Admin and staff only, checked before the service client is touched (the
 * roles whose row policies let them change images; the accountant has none).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Only admin and staff can rotate images" }, { status: 403 });

  // Read against the caller's session (its row policies)…
  const supabase = await getSupabase();
  const { data: img, error: readErr } = await supabase
    .from("piece_images")
    .select("id, piece_id, storage_path_display, storage_path_original, rotation, processing_status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!img) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  if (img.processing_status === "pending" || img.processing_status === "processing") {
    return NextResponse.json(
      { error: "This image is being processed. Rotate it once it reads Ready." },
      { status: 409 },
    );
  }
  if (!img.storage_path_display) {
    return NextResponse.json(
      { error: "This image has no processed version to rotate yet." },
      { status: 409 },
    );
  }
  // The service client below reads and overwrites this path, and no storage
  // policy limits it: the path must be the work's own display master, never
  // one that climbs into another bucket (lib/storage-paths.ts).
  const displayPath = pieceDisplayPath(img.storage_path_display, img.piece_id);
  if (!displayPath) {
    return NextResponse.json(
      { error: "This image's file is not where the studio keeps display images, so it cannot be rotated." },
      { status: 409 },
    );
  }

  // …but read/write the derivatives bucket with the service client: it carries
  // no public policies, exactly as the page's own signed-URL reads do.
  const admin = createServiceClient();
  const bucket = admin.storage.from(DERIVATIVES_BUCKET);

  const { data: file, error: dlErr } = await bucket.download(displayPath);
  if (dlErr || !file) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Could not read the image" },
      { status: 500 },
    );
  }

  let input: Buffer;
  let rotated: Buffer;
  let info: { width: number; height: number; size: number };
  try {
    input = Buffer.from(await file.arrayBuffer());
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

  const { error: upErr } = await bucket.upload(displayPath, rotated, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // The master changed under its own path: forget the website's copy of it
  // and the square tile made from it, so the sync this row's update raises
  // uploads the rotated pixels and renders the tile afresh. (Before the row
  // write, which is what raises that sync.)
  await admin.from("sanity_assets").delete().eq("storage_path", `${DERIVATIVES_BUCKET}/${displayPath}`);
  await admin.from("piece_image_squares").delete().eq("image_id", id);

  // 90° counter-clockwise === 270° clockwise, kept in the 0/90/180/270 domain
  // the column's check constraint allows.
  const startedFrom = img.rotation ?? 0;
  const nextRotation = ((startedFrom + 270) % 360) as 0 | 90 | 180 | 270;

  // Only if nobody else rotated it since this request read it.
  const writeRow = () =>
    admin
      .from("piece_images")
      .update({
        rotation: nextRotation,
        width: info.width,
        height: info.height,
        file_size_bytes: info.size,
      })
      .eq("id", id)
      .eq("rotation", startedFrom)
      .select("id");

  let { data: written, error: updErr } = await writeRow();
  if (updErr) ({ data: written, error: updErr } = await writeRow());
  if (updErr) {
    // The row still says the old angle: put the old pixels back so file and
    // row agree again (the next re-derivation would otherwise turn it once
    // more).
    await bucket.upload(displayPath, input, { contentType: "image/jpeg", upsert: true });
    return NextResponse.json({ error: `The rotation could not be saved: ${updErr.message}` }, { status: 500 });
  }
  if (!written?.length) {
    // Rotated by someone else at the same moment: which turn the file now
    // carries is unknown. Where the original is kept, hand the row back to
    // the worker, which rebuilds the master from it at the recorded angle.
    // (Without an original the worker would mark the row as failed, and the
    // photograph would leave the website, so that row is left as it is.)
    if (img.storage_path_original) {
      await admin
        .from("piece_images")
        .update({ processing_status: "pending" })
        .eq("id", id)
        .not("storage_path_original", "is", null);
    }
    return NextResponse.json(
      {
        error: img.storage_path_original
          ? "This image was rotated by someone else at the same time. It is being rebuilt from the original; check it once it reads Ready."
          : "This image was rotated by someone else at the same time. Reload the page and check it.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    rotation: nextRotation,
    width: info.width,
    height: info.height,
  });
}

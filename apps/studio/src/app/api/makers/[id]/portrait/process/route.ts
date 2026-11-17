import { NextResponse } from "next/server";
import sharp from "sharp";
import convert from "heic-convert";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { detectPortraitFocus } from "@/lib/face/focus";
import { makerPortraitPath, makerPortraitUploadPath } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISPLAY_MAX_PX = 2560;

/**
 * Second leg of the portrait upload: the original is already in storage
 * (uploaded directly by the browser via a signed URL). Generate the
 * auto-rotated sRGB JPEG display master, point the maker at the new pair,
 * and clean up the previous files. iPhone HEIC decodes via heic-convert
 * when libvips can't read it. Admin and staff only, checked before the
 * service client is touched (see ../route.ts).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Your role cannot change makers" }, { status: 403 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("id, portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Exactly the key ./upload-url signs. The service role downloads it and may
  // remove it, so a path that merely starts right ("<id>/original-1/../../…")
  // must not get through.
  const { path: rawPath } = ((await req.json().catch(() => ({}))) ?? {}) as { path?: string };
  const path = makerPortraitUploadPath(rawPath, maker.id);
  if (!path) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const bucket = svc.storage.from("maker-portraits");
  // Files this request wrote may be cleaned up when it fails, but never one
  // the row still names: a replayed request (a retry after a timeout whose
  // first attempt succeeded) carries the path that is now the live portrait.
  const live = new Set([maker.portrait_path, maker.portrait_original_path].filter((p): p is string => !!p));
  const removeNew = async (paths: string[]) => {
    const fresh = paths.filter((p) => !live.has(p));
    if (fresh.length) await bucket.remove(fresh);
  };
  const { data: blob, error: dlErr } = await bucket.download(path);
  if (dlErr || !blob)
    return NextResponse.json({ error: dlErr?.message ?? "Original not found" }, { status: 400 });
  const original = Buffer.from(await blob.arrayBuffer());

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
      await removeNew([path]); // don't leave an unusable original behind
      return NextResponse.json(
        { error: "Could not read this image format — try JPEG, PNG, TIFF or HEIC" },
        { status: 400 },
      );
    }
  }

  const displayPath = path.replace(/^(.*\/)original-(\d+)\.[a-z0-9]+$/, "$1display-$2.jpg");
  const { error: upErr } = await bucket.upload(displayPath, display, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) {
    // The original uploaded for this attempt would otherwise stay with no
    // row pointing at it.
    await removeNew([path]);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Where the face is, so the website can centre its square on it. A
  // detection failure must not lose the upload: the sync retries later.
  const portrait_focus = await detectPortraitFocus(display).catch(() => null);
  // Checked: the old pair is removed only once the row names the new one.
  // On a failure the new pair goes instead, and the maker keeps the
  // portrait it had.
  const { data: updated, error: updErr } = await svc
    .from("makers")
    .update({ portrait_path: displayPath, portrait_original_path: path, portrait_focus })
    .eq("id", maker.id)
    .select("id");
  if (updErr || !updated?.length) {
    await removeNew([displayPath, path]);
    return updErr
      ? NextResponse.json({ error: `The portrait could not be saved: ${updErr.message}` }, { status: 500 })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // The previous pair comes from the row, so only this maker's own files go.
  const stale = [maker.portrait_path, maker.portrait_original_path]
    .map((p) => makerPortraitPath(p, maker.id))
    .filter((p): p is string => !!p && p !== displayPath && p !== path);
  if (stale.length) await bucket.remove(stale);

  const { data: signed } = await bucket.createSignedUrl(displayPath, 3600);
  return NextResponse.json({ ok: true, path: displayPath, url: signed?.signedUrl ?? null });
}

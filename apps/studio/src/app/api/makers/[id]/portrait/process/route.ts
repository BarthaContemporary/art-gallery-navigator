import { NextResponse } from "next/server";
import sharp from "sharp";
import convert from "heic-convert";
import { getSession, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISPLAY_MAX_PX = 2560;

/**
 * Second leg of the portrait upload: the original is already in storage
 * (uploaded directly by the browser via a signed URL). Generate the
 * auto-rotated sRGB JPEG display master, point the maker at the new pair,
 * and clean up the previous files. iPhone HEIC decodes via heic-convert
 * when libvips can't read it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = ((await req.json().catch(() => ({}))) ?? {}) as { path?: string };
  if (!path || !path.startsWith(`${id}/original-`))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const svc = createServiceClient();
  const { data: maker } = await svc
    .from("makers")
    .select("id, portrait_path, portrait_original_path")
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = svc.storage.from("maker-portraits");
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
      await bucket.remove([path]); // don't leave an unusable original behind
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
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await svc
    .from("makers")
    .update({ portrait_path: displayPath, portrait_original_path: path })
    .eq("id", id);
  const stale = [maker.portrait_path, maker.portrait_original_path].filter(
    (p): p is string => !!p && p !== displayPath && p !== path,
  );
  if (stale.length) await bucket.remove(stale);

  const { data: signed } = await bucket.createSignedUrl(displayPath, 3600);
  return NextResponse.json({ ok: true, path: displayPath, url: signed?.signedUrl ?? null });
}

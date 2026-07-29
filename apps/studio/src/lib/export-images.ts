import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase";
import { selectInChunks } from "@/lib/chunk";

/**
 * Thumbnails for exports that embed imagery.
 *
 * The display masters are up to 2560px and a few hundred KB each — fine for one
 * fact sheet, ruinous for a whole inventory. Everything here exists to keep a
 * thousand-row export finishable: take one image per work, fetch a bounded
 * number of them concurrently, and downscale hard before embedding.
 */

export type ExportImage = {
  data: Buffer;
  width: number;
  height: number;
};

/** Longest edge of an embedded thumbnail, in pixels. */
const THUMB_PX = 220;
/** Simultaneous downloads. Enough to be quick, not enough to trip rate limits. */
const CONCURRENCY = 8;
/**
 * Hard ceiling on embedded images per export. A full 1,000-work export with
 * imagery would neither finish inside the request budget nor open comfortably;
 * callers are told how many were dropped so the document can say so rather than
 * quietly appearing complete.
 */
export const IMAGE_CAP = 300;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * One thumbnail per piece id, in the order given. Returns the map plus how many
 * works were left without an image because of the cap, so the caller can be
 * honest about it.
 */
export async function fetchExportThumbnails(
  pieceIds: string[],
  cap: number = IMAGE_CAP,
): Promise<{ images: Map<string, ExportImage>; omitted: number }> {
  const images = new Map<string, ExportImage>();
  if (pieceIds.length === 0) return { images, omitted: 0 };

  // Storage has no public policies, so signing needs the service client.
  const admin = createServiceClient();

  // Chunked — IMAGE_CAP alone is 300 ids, already past the URL limit that
  // returns 414 (lib/chunk.ts).
  const rows = await selectInChunks<{ piece_id: string; storage_path_display: string }>(
    pieceIds,
    (chunk) =>
      admin
        .from("piece_images")
        .select("piece_id, storage_path_display, sort_order")
        .in("piece_id", chunk)
        .not("storage_path_display", "is", null)
        .order("sort_order", { ascending: true, nullsFirst: false }),
  );

  // First image per piece wins; each chunk arrives in sort order.
  const firstByPiece = new Map<string, string>();
  rows.forEach((r) => {
    const pid = r.piece_id as string;
    if (pid && !firstByPiece.has(pid)) firstByPiece.set(pid, r.storage_path_display as string);
  });

  // Preserve the caller's ordering so the cap keeps the first N of the export,
  // not an arbitrary N.
  const ordered = pieceIds
    .filter((id) => firstByPiece.has(id))
    .map((id) => ({ id, path: firstByPiece.get(id)! }));

  const omitted = Math.max(0, ordered.length - cap);
  const take = ordered.slice(0, cap);
  if (take.length === 0) return { images, omitted };

  const { data: signed } = await admin.storage
    .from("piece-derivatives")
    .createSignedUrls(
      take.map((t) => t.path),
      600,
    );

  const targets = take
    .map((t, i) => ({ id: t.id, url: signed?.[i]?.signedUrl ?? null }))
    .filter((t): t is { id: string; url: string } => Boolean(t.url));

  await mapLimit(targets, CONCURRENCY, async ({ id, url }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      const out = await sharp(buf)
        .resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer({ resolveWithObject: true });
      images.set(id, { data: out.data, width: out.info.width, height: out.info.height });
    } catch {
      // A single unreadable image must not fail the whole export.
    }
  });

  return { images, omitted };
}

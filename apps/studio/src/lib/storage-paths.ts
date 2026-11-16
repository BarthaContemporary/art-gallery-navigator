import { safeStoragePath, UUID_PATTERN } from "@jvb/db/storage-path";

/**
 * The storage paths the studio keeps in database rows, checked before a
 * service-role storage call uses one (security review 2026-10, F6). A path
 * read from a row is only as trustworthy as whoever last wrote the row, and
 * the service role ignores every storage policy, so a value that climbs out
 * of its bucket ("<piece>/../../piece-documents/<invoice>") would otherwise
 * read, publish or overwrite a file the user may not see.
 *
 * Every writer names these files directly under the row's own id:
 *   piece-originals    <piece>/<image>.<ext>                 piece_images.storage_path_original
 *   piece-derivatives  <piece>/<image>.jpg                   piece_images.storage_path_display
 *   piece-derivatives  <piece>/<image>.sq-<w>x<h>.jpg        piece_image_squares.square_path
 *   maker-portraits    <maker>/display-<n>.jpg               makers.portrait_path
 *   maker-portraits    <maker>/original-<n>.<ext>            makers.portrait_original_path
 *   piece-documents    <piece>/<uuid>.<ext>,                 piece_documents.storage_path,
 *                      shipments/<shipment>/<uuid>.<ext>,    shipment_documents.storage_path
 *                      documents/<uuid>.<ext>
 * The file name itself is left loose, so rows written before this check keep
 * working; the database (migration 0090) holds new writes by signed-in users
 * to the exact shapes. Pure, so `node --test` can run it.
 */

const ID = new RegExp(`^${UUID_PATTERN}$`);

/** The path when it is one plain file directly under `<ownerId>/`, else null. */
function fileUnder(path: unknown, ownerId: string, file: string): string | null {
  if (!ID.test(ownerId)) return null;
  return safeStoragePath(path, { prefix: `${ownerId}/`, pattern: new RegExp(`^${ownerId}/${file}$`) });
}

/** A display master or square tile in piece-derivatives, under the row's own piece. */
export function pieceDisplayPath(path: unknown, pieceId: string): string | null {
  return fileUnder(path, pieceId, "[^/]+\\.jpg");
}

/** A portrait (display master or original) in maker-portraits, under the maker's own id. */
export function makerPortraitPath(path: unknown, makerId: string): string | null {
  return fileUnder(path, makerId, "[^/]+");
}

/** The original a portrait upload was signed for: `<maker>/original-<n>.<ext>`. */
export function makerPortraitUploadPath(path: unknown, makerId: string): string | null {
  return fileUnder(path, makerId, "original-\\d+\\.[a-z0-9]+");
}

/**
 * A photograph's original in piece-originals, under the row's own piece:
 * `<piece>/<uuid>.<ext>` from the studio uploader and Quick Capture,
 * `<piece>/<image><ext>` from the FileMaker import.
 */
export function pieceOriginalPath(path: unknown, pieceId: string): string | null {
  return fileUnder(path, pieceId, "[^/]+\\.[A-Za-z0-9]+");
}

/**
 * A file in piece-documents as /api/files/sign and Quick Capture name them:
 * under a work (`<piece>/<file>`), a shipment (`shipments/<shipment>/<file>`)
 * or the Documents registry (`documents/<file>`). A document detached from
 * the work it was filed on keeps that work's folder.
 */
export function documentFilePath(path: unknown): string | null {
  return safeStoragePath(path, {
    pattern: new RegExp(`^(?:${UUID_PATTERN}|shipments/${UUID_PATTERN}|documents)/[^/]+\\.[A-Za-z0-9]+$`),
  });
}

/** The buckets whose deleted files the storage sweep removes (migration 0097, storage_removals). */
export const SWEPT_BUCKETS = ["piece-originals", "piece-derivatives", "piece-documents", "maker-portraits"] as const;
export type SweptBucket = (typeof SWEPT_BUCKETS)[number];

/**
 * A key queued in storage_removals, when it is one plain file in the shape
 * its bucket's writers use (under a UUID folder, checked with the column's
 * own helper); else null, and the sweep leaves the object alone. The queue
 * is filled from rows signed-in users could write, so this runs before any
 * service-role remove.
 */
export function queuedRemovalPath(bucket: string, path: unknown): string | null {
  const owner = typeof path === "string" ? (path.split("/")[0] ?? "") : "";
  switch (bucket) {
    case "piece-originals":
      return pieceOriginalPath(path, owner);
    case "piece-derivatives":
      return pieceDisplayPath(path, owner);
    case "maker-portraits":
      return makerPortraitPath(path, owner);
    case "piece-documents":
      return documentFilePath(path);
    default:
      return null;
  }
}

/**
 * Splits what storage_removals_due() handed the sweep into the keys to
 * remove, by bucket, and the ones refused by the shape check (forgotten, the
 * object left where it is). Pure, so `node --test` covers it.
 */
export function planStorageRemovals(rows: readonly { bucket: string; path: string }[]): {
  remove: Map<SweptBucket, string[]>;
  refused: Map<string, string[]>;
} {
  const remove = new Map<SweptBucket, string[]>();
  const refused = new Map<string, string[]>();
  for (const { bucket, path } of rows) {
    const safe = (SWEPT_BUCKETS as readonly string[]).includes(bucket) ? queuedRemovalPath(bucket, path) : null;
    const into = safe === null ? refused : (remove as Map<string, string[]>);
    const list = into.get(bucket) ?? [];
    list.push(safe ?? path);
    into.set(bucket, list);
  }
  return { remove, refused };
}

/**
 * A path the website sync may publish from `bucket`: a display master or tile
 * in piece-derivatives, or a portrait in maker-portraits. Under the row's own
 * id when the caller passes it; otherwise under some piece or maker id, which
 * still keeps the path inside its bucket.
 */
export function publishablePath(bucket: string, path: unknown, ownerId?: string): string | null {
  const file = bucket === "piece-derivatives" ? "[^/]+\\.jpg" : bucket === "maker-portraits" ? "[^/]+" : null;
  if (file === null) return null;
  if (ownerId !== undefined) return fileUnder(path, ownerId, file);
  return safeStoragePath(path, { pattern: new RegExp(`^${UUID_PATTERN}/${file}$`) });
}

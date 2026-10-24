// Copy of packages/db/src/storage-path.ts: keep the two the same. The image
// worker is installed on its own, outside the workspace (see its Dockerfile),
// so it cannot import @jvb/db; this is that module verbatim.

/**
 * Storage object paths that are safe to hand to a privileged (service-role)
 * storage call.
 *
 * Paths often come from database columns that signed-in users can write
 * (piece_images.storage_path_display, makers.portrait_path,
 * capture_photos.storage_path …). The storage client joins the path into the
 * request URL, and URL parsing collapses "." and ".." segments, so a value
 * such as "abc/../../piece-documents/x.pdf" would read an object from another
 * bucket with the service role's rights. Every service-role download, upload,
 * sign or remove of a path that did not come from this request's own code
 * goes through safeStoragePath() first.
 *
 * Self-contained on purpose (no imports): infra/image-worker keeps a copy.
 */

const MAX_LENGTH = 512;

/** One path segment: letters, digits and . _ - only, and not "." or "..". */
const SEGMENT = /^[A-Za-z0-9_.-]+$/;

export type StoragePathRule = {
  /** The path must start with this, e.g. `${pieceId}/`. */
  prefix?: string;
  /** The whole path must match this. */
  pattern?: RegExp;
};

/**
 * The path itself when it is a plain relative object key (and meets the
 * rule), otherwise null. Rejects: anything but a non-empty string, more than
 * 512 characters, a leading "/", a backslash, percent-encoding, control or
 * other unexpected characters, empty segments ("a//b"), and "." or ".."
 * segments.
 */
export function safeStoragePath(path: unknown, rule: StoragePathRule = {}): string | null {
  if (typeof path !== "string") return null;
  if (path.length === 0 || path.length > MAX_LENGTH) return null;
  const segments = path.split("/");
  for (const s of segments) {
    if (!SEGMENT.test(s) || s === "." || s === "..") return null;
  }
  if (rule.prefix !== undefined && !path.startsWith(rule.prefix)) return null;
  if (rule.pattern && !rule.pattern.test(path)) return null;
  return path;
}

/** safeStoragePath() for callers that would rather throw. */
export function assertStoragePath(path: unknown, rule: StoragePathRule = {}): string {
  const safe = safeStoragePath(path, rule);
  if (safe === null) throw new Error("Refused an unsafe storage path");
  return safe;
}

/** A UUID as it appears in object keys. */
export const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

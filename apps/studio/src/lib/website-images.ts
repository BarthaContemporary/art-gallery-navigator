/**
 * Which photographs the website sync publishes, and the storage paths it will
 * read for them. Pure and self-contained (no imports) so `node --test` runs it
 * directly; the sync route and the asset cleanup cron share it.
 */

/**
 * Image roles (the image_role enum) that may appear on the public website:
 * views of the work itself. Not published: "back" (backs carry labels,
 * stickers and collectors' stamps), "condition" (damage the site never
 * shows), "document" (the capture app's label shot: work labels, gallery
 * tickets, lot slips, hand-written notes) and "other". Owner decision 12 of
 * October 2026; PROCESSORS.md lists Sanity as "public content only". A role
 * added to the enum later stays off the site until it is named here.
 */
export const WEBSITE_IMAGE_ROLES = ["front", "side", "signature", "box", "detail"] as const;

export function isWebsiteRole(role: string | null | undefined): boolean {
  return !!role && (WEBSITE_IMAGE_ROLES as readonly string[]).includes(role);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Matches nothing: the rule for an id that is not a UUID. */
const NEVER = /(?!)/;

/** The safeStoragePath() rule shape (packages/db/src/storage-path.ts). */
export type PathRule = { prefix?: string; pattern?: RegExp };

/**
 * A display master as the image worker writes it: `<piece>/<image>.jpg` in
 * piece-derivatives, under the row's own piece and image ids.
 */
export function displayMasterRule(pieceId: string, imageId: string): PathRule {
  if (!UUID.test(pieceId) || !UUID.test(imageId)) return { pattern: NEVER };
  return { prefix: `${pieceId}/`, pattern: new RegExp(`^${pieceId}/${imageId}\\.jpg$`) };
}

/** A square tile as the sync renders it: `<piece>/<image>.sq-<w>x<h>.jpg` in piece-derivatives. */
export function squareTileRule(pieceId: string, imageId: string): PathRule {
  if (!UUID.test(pieceId) || !UUID.test(imageId)) return { pattern: NEVER };
  return { prefix: `${pieceId}/`, pattern: new RegExp(`^${pieceId}/${imageId}\\.sq-\\d{1,5}x\\d{1,5}\\.jpg$`) };
}

/**
 * A maker's portrait: one file in the maker's own folder of maker-portraits
 * (`<maker>/display-<time>.jpg` today; older portraits kept other names).
 */
export function portraitRule(makerId: string): PathRule {
  if (!UUID.test(makerId)) return { pattern: NEVER };
  return { prefix: `${makerId}/`, pattern: new RegExp(`^${makerId}/[A-Za-z0-9_.-]+$`) };
}

/**
 * The piece_images id in the file name the sync gives a work's image when it
 * uploads it to Sanity (the last segment of its storage path: `<image>.jpg`
 * or `<image>.sq-<w>x<h>.jpg`), or null for any other name. Lets the cleanup
 * recognise its own uploads from before they were tracked.
 */
export function syncUploadImageId(filename: string | null | undefined): string | null {
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.sq-\d{1,5}x\d{1,5})?\.jpg$/.exec(filename ?? "");
  return m ? (m[1] as string) : null;
}

/** True for a UUID as the database prints one. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

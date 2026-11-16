/**
 * Pure helpers for the private offer page (app/o/[token]). Import-free so
 * `node --test` runs them directly.
 */

/**
 * Image roles a collector may be shown: views of the work itself. The same
 * five as the website sync's WEBSITE_IMAGE_ROLES
 * (apps/studio/src/lib/website-images.ts, owner decision 12 of October 2026),
 * copied because the website cannot import the studio. Never shown: "back"
 * (labels, collectors' stamps), "condition", "document" (the capture app's
 * label shot: lot slips, gallery tickets, hand-written notes) and "other".
 * offer-lines.test.ts checks the two lists stay equal.
 */
export const OFFER_IMAGE_ROLES = ["front", "side", "signature", "box", "detail"] as const;

export interface OfferImageLike {
  role: string | null;
  sort_order: number | null;
  storage_path_display: string | null;
  processing_status: string | null;
}

/**
 * The picture for a work: among processed images in a website role, the
 * front if there is one, otherwise the lowest sort_order. Null when none
 * qualifies ("Photography to follow").
 */
export function primaryImage<T extends OfferImageLike>(images: readonly T[] | null | undefined): T | null {
  const usable = (images ?? [])
    .filter(
      (img) =>
        !!img.storage_path_display &&
        img.processing_status !== "error" &&
        !!img.role &&
        (OFFER_IMAGE_ROLES as readonly string[]).includes(img.role),
    )
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return usable.find((img) => img.role === "front") ?? usable[0] ?? null;
}

/**
 * Offer lines in the order staff arranged in the studio (offer_items.sort_order),
 * id as the tie-break so equal positions stay stable. Returns a new array.
 */
export function orderOfferLines<T extends { id: string; sort_order?: number | null }>(lines: readonly T[] | null | undefined): T[] {
  return [...(lines ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
  );
}

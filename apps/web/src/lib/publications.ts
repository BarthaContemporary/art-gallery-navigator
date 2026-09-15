import type { PublicationListItem } from "@/lib/sanity";

/** "available" / "out of print" — plain text, never a badge. */
export function availabilityLabel(a: PublicationListItem["availability"]): string {
  return a === "outOfPrint" ? "out of print" : "available";
}

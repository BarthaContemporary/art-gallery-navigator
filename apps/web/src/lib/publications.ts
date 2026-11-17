import type { PublicationListItem } from "@/lib/sanity";

/** "available" / "out of print" — plain text, never a badge. */
export function availabilityLabel(a: PublicationListItem["availability"]): string {
  return a === "outOfPrint" ? "out of print" : "available";
}

/**
 * The publication page's link to the catalogue itself: the uploaded PDF,
 * else the "External / PDF link". Only a PDF is offered as a download; an
 * external catalogue page (a viewer, a publisher's page) is "View catalogue".
 */
export function catalogueLink(p: { pdfUrl: string | null; externalUrl: string | null }): { href: string; label: string } | null {
  if (p.pdfUrl) return { href: p.pdfUrl, label: "Download PDF ↓" };
  if (!p.externalUrl) return null;
  const isPdf = /\.pdf(?:$|[?#])/i.test(p.externalUrl);
  return { href: p.externalUrl, label: isPdf ? "Download PDF ↓" : "View catalogue ↗" };
}

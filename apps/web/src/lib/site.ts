/** Site-wide constants shared by layout, metadata, sitemap and JSON-LD. */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

/** Fallback until Sanity siteSettings is populated. */
export const fallbackGalleryName = "Joost van den Bergh";

/** Four items, identical on every page. Home *is* the Events page. */
export const navLinks = [
  { href: "/", label: "Events" },
  { href: "/artists", label: "Artists" },
  { href: "/publications", label: "Publications" },
  { href: "/about", label: "About" },
] as const;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

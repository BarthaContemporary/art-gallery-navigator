/** Site-wide constants shared by layout, metadata, sitemap and JSON-LD. */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

/** Fallback until Sanity siteSettings is populated. */
export const fallbackGalleryName = "Joost van den Bergh";

export const navLinks = [
  { href: "/exhibitions", label: "Exhibitions" },
  { href: "/publications", label: "Publications" },
  { href: "/works", label: "Works" },
  { href: "/about", label: "About" },
  { href: "/visit", label: "Visit" },
] as const;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Site-wide constants shared by layout, metadata, sitemap and JSON-LD. */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

/** Fallback until Sanity siteSettings is populated. */
export const fallbackGalleryName = "Joost van den Bergh";

export const navLinks = [
  { href: "/works", label: "Works" },
  { href: "/collections", label: "Collections" },
  { href: "/exhibitions", label: "Exhibitions" },
  { href: "/journal", label: "Journal" },
  { href: "/about", label: "About" },
  { href: "/visit", label: "Visit" },
  { href: "/contact", label: "Contact" },
] as const;

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

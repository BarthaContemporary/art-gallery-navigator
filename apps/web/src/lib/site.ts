/** Site-wide constants shared by layout, metadata, sitemap and JSON-LD. */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

/**
 * Artist pages are being rebuilt. While this is true the site hides every
 * route into them: the nav item is shown but not clickable, /artists and
 * /artists/[slug] render behind an "Under construction" overlay with noindex,
 * maker names in work panels are plain text, artists drop out of search, the
 * sitemap and llms.txt, and robots disallows the section. Flip to false to
 * bring everything back in one go.
 */
export const ARTISTS_UNDER_CONSTRUCTION = false;

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

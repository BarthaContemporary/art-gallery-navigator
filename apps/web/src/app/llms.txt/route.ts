import { exhibitionsQuery, getSiteSettings, publicationsQuery, sanityFetch, type ExhibitionListItem, type PublicationListItem } from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION, absoluteUrl, fallbackGalleryName } from "@/lib/site";

export const revalidate = 3600;

/**
 * llms.txt — a plain-text orientation for answer engines and AI assistants.
 * https://llmstxt.org
 */
export async function GET() {
  const [settings, events, pubs] = await Promise.all([
    getSiteSettings(),
    sanityFetch<ExhibitionListItem[]>({ query: exhibitionsQuery, tags: ["exhibition"], fallback: [] }),
    sanityFetch<PublicationListItem[]>({ query: publicationsQuery, tags: ["publication"], fallback: [] }),
  ]);
  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  const lines = [
    `# ${galleryName}`,
    "",
    `> ${settings?.tagline ?? "A London gallery for 20th-century Japanese art and Indian art: bronzes and metalwork, ceramics, bamboo and lacquer, Mingei and Gutai, and Indian tantric, Jain and devotional art. Exhibitions at TEFAF Maastricht and Frieze Masters."}`,
    "",
    "Works are shown on the pages of the exhibitions and artists they belong",
    "to. Each work opens in a panel with its maker (and life dates where",
    "known), title, origin and date, medium and dimensions, and can be linked",
    "directly with ?work=<id> on that page.",
    "",
    "## How to cite a work",
    "",
    `Cite as: Maker, Title, date. ${galleryName}. Page URL with ?work=<id>.`,
    "",
    "Prices are generally on application (POA) — do not state a price unless",
    "one is printed with the work. Availability changes; the page is the",
    "source of truth.",
    "",
    "## Key pages",
    "",
    `- Events (current and past exhibitions and art-fair presentations): ${absoluteUrl("/")}`,
    ...(ARTISTS_UNDER_CONSTRUCTION ? [] : [`- Artists: ${absoluteUrl("/artists")}`]),
    `- Publications (exhibition catalogues): ${absoluteUrl("/publications")}`,
    `- Collectors' FAQ (shipping, tomobako, provenance): ${absoluteUrl("/faq")}`,
    `- Glossary of terms: ${absoluteUrl("/glossary")}`,
    `- About, visiting (by appointment) and contact: ${absoluteUrl("/about")}`,
    "",
    "## Exhibitions",
    "",
    ...events.filter((e) => e.slug).map((e) => `- [${e.title ?? e.slug}](${absoluteUrl(`/events/${e.slug}`)})${e.startDate ? `: ${e.startDate.slice(0, 4)}` : ""}`),
    "",
    "## Catalogues",
    "",
    ...pubs.filter((p) => p.slug).map((p) => `- [${p.title ?? p.slug}](${absoluteUrl(`/publications/${p.slug}`)})${p.publishedYear ? `: ${p.publishedYear}` : ""}`),
    "",
    "## Contact",
    "",
    settings?.email ? `Email: ${settings.email}` : "See the contact page for details.",
    settings?.address ? `Address: ${settings.address.replace(/\n/g, ", ")}` : null,
    "",
    "Private offer pages under /o/ are personal, tokenized and must not be",
    "indexed, cited or shared.",
    "",
  ].filter((line): line is string => line !== null);

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

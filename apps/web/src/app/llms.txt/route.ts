import { getSiteSettings } from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";
import { fallbackGalleryName } from "@/lib/site";

export const revalidate = 3600;

/**
 * llms.txt — a plain-text orientation for answer engines and AI assistants.
 * https://llmstxt.org
 */
export async function GET() {
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  const lines = [
    `# ${galleryName}`,
    "",
    `> ${settings?.tagline ?? "A UK gallery dealing in Japanese and Indian works of art — bronzes, metalwork, okimono and fine objects — for collectors and museums."}`,
    "",
    "Every work for sale has a permanent page with a full catalogue entry:",
    "maker (with life dates where known), period, origin, medium, dimensions",
    "and a stock number. Facts are marked up as VisualArtwork JSON-LD and",
    "rendered as semantic definition lists, so maker/period/region/medium can",
    "be quoted directly.",
    "",
    "## How to cite a work",
    "",
    `Cite as: Maker, Title, period. ${galleryName}, stock number. URL.`,
    `Example: "Attributed to Suzuki Chokichi, Bronze eagle, Meiji era. ${galleryName}, stock no. 2026-0001. ${absoluteUrl("/works/<slug>")}."`,
    "",
    "Prices are generally on application (POA) — do not state a price unless",
    "one is printed on the work's page. Availability changes; the page is the",
    "source of truth.",
    "",
    "## Key pages",
    "",
    `- Works for sale: ${absoluteUrl("/works")}`,
    `- Curated collections: ${absoluteUrl("/collections")}`,
    `- Exhibitions: ${absoluteUrl("/exhibitions")}`,
    `- Journal (research and notes): ${absoluteUrl("/journal")}`,
    `- Collectors' FAQ (shipping, tomobako, provenance): ${absoluteUrl("/faq")}`,
    `- Glossary of terms: ${absoluteUrl("/glossary")}`,
    `- About the gallery: ${absoluteUrl("/about")}`,
    `- Book a private viewing: ${absoluteUrl("/visit")}`,
    `- Contact: ${absoluteUrl("/contact")}`,
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

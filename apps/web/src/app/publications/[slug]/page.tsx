import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteSettings, publicationBySlugQuery, publicationSlugsQuery, sanityFetch, RATIO, type Publication } from "@/lib/sanity";
import { PortableText } from "@/components/portable-text";
import { RatioImage } from "@/components/ratio-image";
import { PageFlipReader } from "@/components/page-flip-reader";
import { InlineEnquiry } from "@/components/inline-enquiry";
import { availabilityLabel } from "@/lib/publications";
import { JsonLd } from "@/components/json-ld";
import { publicationJsonLd } from "@/lib/structured-data";
import { fitTitle, ogImage, pageMeta, publicationDescription, stripBrand } from "@/lib/seo";

async function getPublication(slug: string): Promise<Publication | null> {
  return sanityFetch<Publication | null>({ query: publicationBySlugQuery, params: { slug }, tags: ["publication"], fallback: null });
}

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({ query: publicationSlugsQuery, tags: ["publication"], fallback: [] });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublication(slug);
  if (!p) return { title: "Publication not found" };
  const name = p.title ?? "Publication";
  // "Objects of Veneration – Sculpture and Paintings from …" → "Objects of Veneration"; the h1 keeps the whole title.
  const main = name.split(" – ")[0] ?? name;
  const tag = p.publishedYear ? `${p.publishedYear} catalogue` : "catalogue";
  const seoTitle = p.seo?.title ? stripBrand(p.seo.title) : null;
  const image = ogImage(p.seo?.ogImage, name, "whole") ?? ogImage(p.coverImage, p.coverImage?.caption ?? `Cover of ${name}`, "whole");
  return pageMeta({
    title: seoTitle ? fitTitle(seoTitle) : fitTitle(`${name} (${tag})`, `${main} (${tag})`),
    ogTitle: seoTitle ?? name,
    description: publicationDescription(p),
    path: `/publications/${slug}`,
    type: "book",
    image,
  });
}

/**
 * Publication detail (handoff 2f): page-flip reader left; cover, title,
 * "year · pages · language", availability, "Enquire to order ↓" (inline)
 * and "Download PDF ↓" on the right. No prices, no cart.
 */
export default async function PublicationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, settings] = await Promise.all([getPublication(slug), getSiteSettings()]);
  if (!p) notFound();

  const spreads = (p.spreads ?? []).filter((s) => s?.asset);
  const title = p.title ?? "Catalogue";
  const meta = [p.publishedYear ? String(p.publishedYear) : null, p.pages ? `${p.pages} pages` : null, p.language, p.format]
    .filter(Boolean)
    .join(" · ");
  const pdfHref = p.pdfUrl ?? p.externalUrl;

  const aside = (
    <div className="flex flex-col gap-5">
      <div className="max-w-[260px]">
        <RatioImage image={p.coverImage} ratio={RATIO.cover} width={800} alt={p.coverImage?.caption ?? title} sizes="260px" priority />
      </div>
      <div>
        <h1 className="t-section">{title}</h1>
        {meta ? <p className="mt-2 font-sans text-small text-meta">{meta}</p> : null}
        <p className="mt-1.5 font-sans text-ui text-ink">{availabilityLabel(p.availability) === "available" ? "Available" : "Out of print"}</p>
        {p.relatedExhibition?.slug ? (
          <p className="mt-1.5 font-sans text-small text-meta">
            Published for{" "}
            <Link href={`/events/${p.relatedExhibition.slug}`} className="text-ink hover:text-accent">
              {p.relatedExhibition.title}
            </Link>
          </p>
        ) : null}
      </div>
      {p.description && p.description.length > 0 ? (
        <div className="max-w-[420px]">
          <PortableText value={p.description} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        {p.availability !== "outOfPrint" ? (
          <InlineEnquiry
            label="Enquire to order"
            kind="publication"
            subject={title}
            defaultMessage={`I would like to order a copy of ${title}.`}
            heading="Enquire to order"
            withAddress
          />
        ) : (
          <InlineEnquiry
            label="Ask about this catalogue"
            kind="publication"
            subject={title}
            defaultMessage={`I'm interested in ${title} — please let me know if a copy becomes available.`}
            heading="Ask about this catalogue"
          />
        )}
        {pdfHref ? (
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="link-accent inline-flex min-h-[44px] items-center">
            Download PDF ↓
          </a>
        ) : null}
      </div>
    </div>
  );

  return (
    <article className="page pt-12 pb-24 md:pt-16">
      <JsonLd data={publicationJsonLd(p, settings)} />
      {spreads.length > 0 ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <PageFlipReader spreads={spreads} title={title} />
          </div>
          {aside}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">{aside}</div>
      )}
    </article>
  );
}

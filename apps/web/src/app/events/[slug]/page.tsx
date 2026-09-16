import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  exhibitionBySlugQuery,
  exhibitionSlugsQuery,
  getSiteSettings,
  imageUrl,
  sanityFetch,
  type Exhibition,
} from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName } from "@/lib/site";
import { ACCESS_LABEL, eventDates, eventEyebrow, eventPlace, privateViewWhen } from "@/lib/events";
import { catalogueToGrid, workToGrid, type GridWork } from "@/lib/grid-work";
import { JsonLd } from "@/components/json-ld";
import { PortableText } from "@/components/portable-text";
import { HeroSlideshow, type Slide } from "@/components/hero-slideshow";
import { ReadMore } from "@/components/read-more";
import { WorksFoldout } from "@/components/works-foldout";

async function getEvent(slug: string): Promise<Exhibition | null> {
  return sanityFetch<Exhibition | null>({
    query: exhibitionBySlugQuery,
    params: { slug },
    tags: ["exhibition", "work", "publication"],
    fallback: null,
  });
}

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({ query: exhibitionSlugsQuery, tags: ["exhibition"], fallback: [] });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getEvent(slug);
  if (!ev) return { title: "Event not found" };
  const dates = eventDates(ev.startDate, ev.endDate, ev.datePrecision);
  const title = ev.seo?.title ?? ev.title ?? "Event";
  const description = ev.seo?.description ?? ([ev.subtitle, eventPlace(ev), dates].filter(Boolean).join(" · ") || undefined);
  const ogImage = imageUrl(ev.seo?.ogImage, { width: 1200 }) ?? imageUrl(ev.heroImages?.[0] ?? ev.coverImage, { width: 1200 });
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/events/${slug}`) },
    openGraph: { title, description, type: "article", url: absoluteUrl(`/events/${slug}`), images: ogImage ? [{ url: ogImage }] : undefined },
  };
}

/**
 * Event detail (handoff 2b): slideshow at the very top, a narrow text block,
 * the works grid with its fold-out panel, then prev / next.
 */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [ev, settings] = await Promise.all([getEvent(slug), getSiteSettings()]);
  if (!ev) notFound();

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const dates = eventDates(ev.startDate, ev.endDate, ev.datePrecision);
  const privateViews = (ev.privateViews ?? []).filter((v) => v?.start);
  const heroImages = (ev.heroImages ?? []).filter((i) => i?.asset);
  const slides: Slide[] = (heroImages.length ? heroImages : ev.coverImage?.asset ? [ev.coverImage] : []).map((img, i) => ({
    key: img._key ?? String(i),
    image: img,
    eyebrow: "",
    title: img.caption ?? ev.title ?? "Event",
    meta: null,
    href: null,
  }));

  const works: GridWork[] = [
    ...(ev.works ?? []).map(workToGrid).filter((w): w is GridWork => w !== null),
    ...(ev.catalogue ?? []).filter((c) => c?.image).map(catalogueToGrid),
  ];

  const catalogueHref = ev.pdfUrl ?? (ev.relatedPublication?.slug ? `/publications/${ev.relatedPublication.slug}` : null);
  const pageUrl = absoluteUrl(`/events/${slug}`);
  const place = [ev.isArtFair ? ev.fairName : null, ev.venue, ev.stand ? `Stand ${ev.stand}` : null].filter(Boolean).join(" · ");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: ev.title ?? "Event",
    url: pageUrl,
    startDate: ev.startDate ?? undefined,
    endDate: ev.endDate ?? undefined,
    description: ev.subtitle ?? undefined,
    image: imageUrl(heroImages[0] ?? ev.coverImage, { width: 1600 }) ?? undefined,
    organizer: { "@type": "ArtGallery", name: galleryName, url: absoluteUrl("/") },
    ...(place ? { location: { "@type": "Place", name: place } } : {}),
  };

  return (
    <article>
      <JsonLd data={jsonLd} />
      {slides.length > 0 ? <HeroSlideshow slides={slides} caption={false} /> : null}

      <div className="page pt-10 pb-20 md:pt-12">
        <header className="max-w-[380px]">
          <p className="eyebrow">{eventEyebrow(ev)}</p>
          <h1 className="t-title mt-2">{ev.title}</h1>
          {ev.subtitle ? <p className="mt-2 font-sans text-body text-body">{ev.subtitle}</p> : null}
          {dates || ev.stand ? (
            <p className="mt-2 font-sans text-small text-meta">{[dates, ev.stand ? `Stand ${ev.stand}` : null].filter(Boolean).join(" · ")}</p>
          ) : null}
          {privateViews.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 font-sans text-small text-meta">
              {privateViews.map((v) => (
                <li key={v._key}>
                  <span className="text-ink">{v.label ?? "Private view"}</span>
                  {" · "}
                  {privateViewWhen(v.start, v.end)}
                  {v.access ? ` · ${ACCESS_LABEL[v.access]}` : null}
                  {v.note ? ` · ${v.note}` : null}
                </li>
              ))}
            </ul>
          ) : null}
          {ev.intro && ev.intro.length > 0 ? (
            <div className="prose-event mt-5">
              <PortableText value={ev.intro} />
            </div>
          ) : null}
          {ev.longText && ev.longText.length > 0 ? (
            <ReadMore className="mt-1">
              <div className="prose-event">
                <PortableText value={ev.longText} />
              </div>
            </ReadMore>
          ) : null}
          {catalogueHref ? (
            <p className="mt-3">
              {ev.pdfUrl ? (
                <a href={ev.pdfUrl} target="_blank" rel="noopener noreferrer" className="link-accent inline-flex min-h-[44px] items-center">
                  Catalogue (PDF) ↓
                </a>
              ) : (
                <Link href={catalogueHref} className="link-accent inline-flex min-h-[44px] items-center">
                  Catalogue →
                </Link>
              )}
            </p>
          ) : null}
        </header>

        {works.length > 0 ? (
          <section className="mt-14 md:mt-16">
            <WorksFoldout works={works} label="Works" />
          </section>
        ) : null}

        <nav aria-label="Other events" className="mt-16 flex flex-wrap items-baseline justify-between gap-4 font-sans text-ui">
          {ev.prev?.slug ? (
            <Link href={`/events/${ev.prev.slug}`} className="link-accent inline-flex min-h-[44px] items-center">
              ← {ev.prev.title}
            </Link>
          ) : (
            <span />
          )}
          {ev.next?.slug ? (
            <Link href={`/events/${ev.next.slug}`} className="link-accent inline-flex min-h-[44px] items-center text-right">
              {ev.next.title} →
            </Link>
          ) : ev.relatedPublication?.slug ? (
            <Link href={`/publications/${ev.relatedPublication.slug}`} className="link-accent inline-flex min-h-[44px] items-center">
              Related catalogue →
            </Link>
          ) : (
            <Link href="/" className="link-accent inline-flex min-h-[44px] items-center">
              All events →
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}

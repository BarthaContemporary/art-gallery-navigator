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
  type Work,
} from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName } from "@/lib/site";
import { ACCESS_LABEL, eventDates, eventEyebrow, eventPlace, privateViewWhen } from "@/lib/events";
import { arrangeWorks } from "@/lib/arrange-works";
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
    tags: ["exhibition", "work", "workList", "publication"],
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

  // Every work the event can show, once each: those chosen by hand and every
  // web-visible work of the attached inventory lists. This source order is
  // only the final tie-break; `arrangeWorks` decides what the visitor sees.
  // The legacy catalogue follows in its own Studio order.
  const seenWork = new Set<string>();
  const uniqueWorks = (list: Work[] | null | undefined) =>
    (list ?? []).filter((w) => {
      if (!w?._id || seenWork.has(w._id)) return false;
      seenWork.add(w._id);
      return true;
    });
  const sourceWorks: Work[] = [
    ...uniqueWorks(ev.works),
    ...(ev.workLists ?? []).flatMap((l) => uniqueWorks(l?.works)),
  ];
  // The editor's arrangement wins; the rest reads A to Z by artist.
  const arranged = arrangeWorks(sourceWorks, ev.workOrder);
  const works: GridWork[] = [
    ...arranged.map(workToGrid).filter((w): w is GridWork => w !== null),
    ...(ev.catalogue ?? []).filter((c) => c?.image).map(catalogueToGrid),
  ];

  // The banner is a slow slideshow of the slides uploaded for the event in
  // the Studio ("Slideshow images"); with none uploaded, the cover image sits
  // still. Works are shown in the panel below, never in the banner.
  const bannerImages = heroImages.length > 0 ? heroImages : ev.coverImage?.asset ? [ev.coverImage] : [];
  const slides: Slide[] = bannerImages.map((img, i) => ({
    key: img._key ?? `slide-${i}`,
    image: img,
    eyebrow: "",
    title: img.caption ?? ev.title ?? "Event",
    meta: null,
    href: null,
  }));

  // A catalogue that exists in Publications is linked there — its reader,
  // availability and ordering — rather than as a bare PDF.
  const publicationHref = ev.relatedPublication?.slug ? `/publications/${ev.relatedPublication.slug}` : null;
  const catalogueHref = publicationHref ?? ev.pdfUrl ?? null;
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
      {slides.length > 0 ? (
        <HeroSlideshow slides={slides} caption={false} intervalMs={9000} fadeMs={1800} label={ev.title ?? "Event"} />
      ) : null}

      <div className="page pt-12 pb-24 md:pt-16">
        {/* Desktop: the facts of the event on the left, the introduction at a
            reading measure on the right; one column on phones. */}
        <header className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-x-10 lg:gap-x-14">
          <div className="md:col-span-5 lg:col-span-4">
            <p className="eyebrow">{eventEyebrow(ev)}</p>
            <h1 className="t-title mt-3">{ev.title}</h1>
            {ev.subtitle ? <p className="mt-3 font-sans text-body text-body">{ev.subtitle}</p> : null}
            {dates || ev.stand ? (
              <p className="mt-3 whitespace-pre-line font-sans text-small text-meta">
                {[dates, ev.stand ? `Stand ${ev.stand}` : null].filter(Boolean).join("\n")}
              </p>
            ) : null}
            {privateViews.length > 0 ? (
              <section aria-labelledby="private-views" className="mt-8 border-t border-hairline pt-5">
                <h2 id="private-views" className="font-sans text-small font-medium text-ink">
                  Private views and opening hours
                </h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {privateViews.map((v) => (
                    <li key={v._key} className="font-sans text-small leading-[1.6]">
                      <p className="text-ink">
                        {v.label ?? "Private view"}
                        {v.access && ACCESS_LABEL[v.access] ? <span className="text-meta"> · {ACCESS_LABEL[v.access]}</span> : null}
                      </p>
                      <p className="text-meta">{privateViewWhen(v.start, v.end)}</p>
                      {v.note ? <p className="text-meta">{v.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="max-w-[var(--measure)] md:col-span-7 lg:col-span-7 lg:col-start-6">
            {ev.intro && ev.intro.length > 0 ? (
              <div className="prose-event">
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
              <p className="mt-4">
                {publicationHref ? (
                  <Link href={publicationHref} className="link-accent inline-flex min-h-[44px] items-center">
                    {ev.relatedPublication?.title ? `Catalogue: ${ev.relatedPublication.title} →` : "Catalogue →"}
                  </Link>
                ) : (
                  <a href={catalogueHref} target="_blank" rel="noopener noreferrer" className="link-accent inline-flex min-h-[44px] items-center">
                    Catalogue (PDF) ↓
                  </a>
                )}
              </p>
            ) : null}
          </div>
        </header>

        {works.length > 0 ? (
          <section className="mt-16 md:mt-20">
            <WorksFoldout works={works} label="Works" />
          </section>
        ) : null}

        <nav aria-label="Other events" className="mt-20 flex flex-wrap items-baseline justify-between gap-4 font-sans text-ui">
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

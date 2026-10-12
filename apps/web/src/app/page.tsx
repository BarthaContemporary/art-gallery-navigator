import type { Metadata } from "next";
import { exhibitionsQuery, getSiteSettings, sanityFetch, type ExhibitionListItem } from "@/lib/sanity";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";
import { eventDates, eventEyebrow, eventStatus } from "@/lib/events";
import { HeroSlideshow, type Slide } from "@/components/hero-slideshow";
import { EventTile } from "@/components/event-tile";
import { InfiniteGrid } from "@/components/infinite-grid";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  // Site settings → Default SEO can override the built-in wording without a deploy.
  const title = settings?.defaultSeo?.title ?? HOME_TITLE;
  return pageMeta({
    title: { absolute: title },
    ogTitle: title,
    description: settings?.defaultSeo?.description ?? HOME_DESCRIPTION,
    path: "/",
  });
}

/**
 * Home is the Events page (handoff 2a): hero slideshow of current and
 * forthcoming events, then the whole archive newest-first as 16:9 tiles.
 */
export default async function HomePage() {
  const [events, settings] = await Promise.all([
    sanityFetch<ExhibitionListItem[]>({ query: exhibitionsQuery, tags: ["exhibition"], fallback: [] }),
    getSiteSettings(),
  ]);

  const live = events.filter((e) => eventStatus(e) !== "past");
  const past = events.filter((e) => eventStatus(e) === "past");
  // Current shows lead, then forthcoming by opening date; with nothing on,
  // the most recent events fill the hero.
  const heroEvents =
    live.length > 0
      ? [...live].sort((a, b) => {
          const sa = eventStatus(a) === "current" ? 0 : 1;
          const sb = eventStatus(b) === "current" ? 0 : 1;
          if (sa !== sb) return sa - sb;
          return (a.startDate ?? "").localeCompare(b.startDate ?? "");
        })
      : past.slice(0, 4);

  const slides: Slide[] = heroEvents
    .filter((e) => e.slug)
    .map((e) => ({
      key: e._id,
      image: e.hero ?? e.coverImage,
      eyebrow: eventEyebrow(e),
      title: e.title ?? "Untitled",
      // Dates on their own line, the venue beneath (rendered pre-line).
      meta: [eventDates(e.startDate, e.endDate, e.datePrecision), e.isArtFair && e.venue ? e.venue : null].filter(Boolean).join("\n") || null,
      href: `/events/${e.slug}`,
    }));

  return (
    <>
      {/* The page's one h1, for search engines and screen readers; the hero caption stays an h2. */}
      <h1 className="sr-only">Joost van den Bergh – 20th-century Japanese and Indian art, London</h1>
      <HeroSlideshow slides={slides} />

      {/* Site settings → About teaser ("Short paragraph shown on the home page"); nothing renders until it is filled. */}
      {settings?.aboutTeaser ? (
        <section className="page mt-12 md:mt-16">
          <p className="max-w-[var(--measure)] font-sans text-body text-body">{settings.aboutTeaser}</p>
        </section>
      ) : null}

      <section className="page mt-14 pb-24 md:mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="t-section">Previous events</h2>
          <span className="font-sans text-small text-meta">
            {past.length} {past.length === 1 ? "event" : "events"}
          </span>
        </div>
        {past.length === 0 ? (
          <p className="mt-8 font-sans text-body text-meta">Past events will appear here.</p>
        ) : (
          <div className="mt-8">
            <InfiniteGrid pageSize={16}>
              {past.map((e, i) => (
                <li key={e._id}>
                  <EventTile event={e} priority={i < 4} />
                </li>
              ))}
            </InfiniteGrid>
          </div>
        )}
      </section>
    </>
  );
}

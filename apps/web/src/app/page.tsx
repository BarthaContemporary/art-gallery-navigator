import { exhibitionsQuery, sanityFetch, type ExhibitionListItem } from "@/lib/sanity";
import { eventDates, eventEyebrow, eventStatus } from "@/lib/events";
import { HeroSlideshow, type Slide } from "@/components/hero-slideshow";
import { EventTile } from "@/components/event-tile";
import { InfiniteGrid } from "@/components/infinite-grid";

export const revalidate = 3600;

/**
 * Home is the Events page (handoff 2a): hero slideshow of current and
 * forthcoming events, then the whole archive newest-first as 16:9 tiles.
 */
export default async function HomePage() {
  const events = await sanityFetch<ExhibitionListItem[]>({
    query: exhibitionsQuery,
    tags: ["exhibition"],
    fallback: [],
  });

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
      meta: [eventDates(e.startDate, e.endDate), e.isArtFair && e.venue ? e.venue : null].filter(Boolean).join(" · ") || null,
      href: `/events/${e.slug}`,
    }));

  return (
    <>
      <HeroSlideshow slides={slides} />

      <section className="page mt-12 pb-20 md:mt-16">
        <div className="flex items-baseline justify-between">
          <h2 className="t-section">Recent exhibitions</h2>
          <span className="font-sans text-meta text-meta">
            {past.length} {past.length === 1 ? "event" : "events"}
          </span>
        </div>
        {past.length === 0 ? (
          <p className="mt-8 font-sans text-body text-meta">Past events will appear here.</p>
        ) : (
          <div className="mt-6">
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

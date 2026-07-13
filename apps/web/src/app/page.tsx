import Link from "next/link";
import groq from "groq";
import {
  exhibitionsQuery,
  getSiteSettings,
  imageDimensions,
  imageUrl,
  sanityFetch,
  type ExhibitionListItem,
  type Work,
} from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { HeroSlideshow, type HeroSlide } from "@/components/hero-slideshow";
import { ExhibitionCard, isCurrentExhibition } from "@/components/exhibition-card";
import { workImageAlt } from "@/components/work-card";

const latestWorksQuery = groq`*[_type == "work" && defined(slug.current)] | order(_createdAt desc)[0...8]{
  _id, "slug": slug.current, stockNumber, title, maker, makerLifeDates,
  period, originRegion, medium, dimensionsDisplay, description,
  priceDisplay, available, supabaseId, category, categorySlug,
  images[]{ _key, asset, caption, role }
}`;

function toSlide(work: Work): HeroSlide | null {
  const hero = work.images?.[0];
  const src = imageUrl(hero, { width: 2200 });
  const dims = imageDimensions(hero);
  if (!src || !dims || !work.slug) return null;
  return {
    src,
    alt: workImageAlt(work, hero?.caption),
    href: `/works/${work.slug}`,
    label: [work.maker, work.title].filter(Boolean).join(" — ") || work.title,
    width: dims.width,
    height: dims.height,
  };
}

export default async function HomePage() {
  const [settings, exhibitions] = await Promise.all([
    getSiteSettings(),
    sanityFetch<ExhibitionListItem[]>({
      query: exhibitionsQuery,
      tags: ["exhibition"],
      fallback: [],
    }),
  ]);

  let featured = settings?.featuredWorks?.filter((w) => w?.slug) ?? [];
  if (featured.length === 0) {
    featured = await sanityFetch<Work[]>({
      query: latestWorksQuery,
      tags: ["work"],
      fallback: [],
    });
  }

  const slides = featured
    .map(toSlide)
    .filter((s): s is HeroSlide => s !== null)
    .slice(0, 8);

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const statement =
    settings?.tagline ??
    "Indian and Japanese art. London, by appointment.";

  // Current & recent exhibitions: current first, then most recent past.
  const current = exhibitions.filter((e) => isCurrentExhibition(e));
  const recent = [...current, ...exhibitions.filter((e) => !isCurrentExhibition(e))].slice(0, 3);

  return (
    <>
      {slides.length > 0 ? (
        <HeroSlideshow slides={slides} />
      ) : (
        <section className="border-b border-line-soft bg-band">
          <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
            <h1 className="text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
              {galleryName}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-ink-muted">{statement}</p>
          </div>
        </section>
      )}

      {/* One-line gallery statement. */}
      <section className="border-b border-line-soft">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="max-w-2xl text-lg leading-relaxed text-ink-body sm:text-xl">
            {settings?.aboutTeaser ??
              "Joost van den Bergh is a London gallery of Indian and Japanese art — tantric drawings, bronzes, Mingei and 20th-century Japanese design. By appointment."}
          </p>
        </div>
      </section>

      {/* Current & recent exhibitions. */}
      {recent.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-label-soft">
              Current &amp; recent exhibitions
            </h2>
            <Link
              href="/exhibitions"
              className="text-sm text-ink-mid transition-colors hover:text-ink-strong"
            >
              All exhibitions
            </Link>
          </div>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((exhibition) => (
              <li key={exhibition._id}>
                <ExhibitionCard exhibition={exhibition} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

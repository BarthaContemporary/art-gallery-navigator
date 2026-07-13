import Link from "next/link";
import groq from "groq";
import {
  exhibitionsQuery,
  getSiteSettings,
  sanityFetch,
  type ExhibitionListItem,
  type Work,
} from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import {
  ExhibitionHero,
  isCurrentExhibition,
} from "@/components/exhibition-card";
import { WorkCard } from "@/components/work-card";

const latestWorksQuery = groq`*[_type == "work" && defined(slug.current)] | order(_createdAt desc)[0...8]{
  _id, "slug": slug.current, stockNumber, title, maker, makerLifeDates,
  period, originRegion, medium, dimensionsDisplay, description,
  priceDisplay, available, supabaseId, category, categorySlug,
  images[]{ _key, asset, caption, role }
}`;

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
  const selected = featured.slice(0, 6);

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const statement =
    settings?.aboutTeaser ??
    "Joost van den Bergh is a London gallery of Indian and Japanese art — tantric drawings, bronzes, Mingei and 20th-century Japanese design. By appointment.";

  // Current first, then most recent past.
  const current = exhibitions.filter((e) => isCurrentExhibition(e));
  const heroExhibition =
    current[0] ??
    exhibitions.filter((e) => !isCurrentExhibition(e))[0] ??
    null;

  return (
    <>
      {/* Featured exhibition hero, or a quiet wordmark fallback. */}
      <section className="page pt-16">
        {heroExhibition ? (
          <ExhibitionHero exhibition={heroExhibition} />
        ) : (
          <div className="grid12">
            <div className="col-span-12 md:col-span-8">
              <h1 className="font-sans text-display font-medium text-sumi">
                {galleryName}
              </h1>
              <p className="mt-6 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
                Indian and Japanese art. London, by appointment.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Selected works. */}
      {selected.length > 0 ? (
        <section className="page mt-[var(--section)]">
          <div className="section-head grid12">
            <span className="label col-span-2 text-oranje md:col-span-1">
              01
            </span>
            <div className="col-span-10 flex items-baseline justify-between md:col-span-11">
              <h2 className="label text-sumi">Selected works</h2>
              <Link href="/works" className="link-inline font-sans text-ui text-ink-70">
                All works
              </Link>
            </div>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {selected.map((work) => (
              <li key={work._id}>
                <WorkCard work={work} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Gallery statement — serif voice, offset to cols 4–8. */}
      <section className="page mt-[var(--section)]">
        <div className="grid12">
          <p className="col-span-12 max-w-[var(--measure)] font-serif text-[26px] font-light leading-[1.45] text-ink-70 md:col-span-8 md:col-start-4">
            {statement}
          </p>
        </div>
      </section>

      {/* Dark Visit band — inverted. */}
      <section className="mt-[var(--section)] bg-sumi text-washi">
        <div className="page grid12 py-[var(--section)]">
          <div className="col-span-12 md:col-span-8">
            <p className="label text-washi/70">Visit</p>
            <h2 className="mt-4 font-sans text-h1 font-medium tracking-tight text-washi">
              By appointment, in London.
            </h2>
            <p className="mt-5 max-w-[var(--measure)] font-serif text-lead font-light text-washi/80">
              Choose a date and time and we will confirm by email, with a calendar
              invitation to add in one click.
            </p>
            <Link href="/visit" className="btn btn-invert mt-10">
              Book a private viewing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

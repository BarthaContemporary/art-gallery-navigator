import Link from "next/link";
import groq from "groq";
import { getSiteSettings, sanityFetch, type Work } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { WorkGrid } from "@/components/work-card";

const latestWorksQuery = groq`*[_type == "work" && defined(slug.current)] | order(_createdAt desc)[0...6]{
  _id, "slug": slug.current, stockNumber, title, maker, makerLifeDates,
  period, originRegion, medium, dimensionsDisplay, description,
  priceDisplay, available, supabaseId, category, categorySlug,
  images[]{ _key, asset, caption, role }
}`;

export default async function HomePage() {
  const settings = await getSiteSettings();

  let featured = settings?.featuredWorks?.filter((w) => w?.slug) ?? [];
  if (featured.length === 0) {
    featured = await sanityFetch<Work[]>({
      query: latestWorksQuery,
      tags: ["work"],
      fallback: [],
    });
  }

  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line-soft bg-band">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink-strong sm:text-4xl">
            {settings?.tagline ?? "Japanese and Indian works of art"}
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
            {settings?.aboutTeaser ??
              `${galleryName} deals in fine Japanese and Indian works of art — bronzes, metalwork and objects of quiet distinction, sourced for collectors and museums.`}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/works"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
            >
              Browse the works
            </Link>
            <Link
              href="/visit"
              className="inline-flex min-h-11 items-center rounded-control border border-line-control bg-control px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-control-active"
            >
              Book a viewing
            </Link>
          </div>
        </div>
      </section>

      {/* Featured works */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-heading">Selected works</h2>
          <Link href="/works" className="text-sm text-ink-mid hover:text-ink-strong">
            View all
          </Link>
        </div>
        <WorkGrid works={featured} />
      </section>

      {/* About teaser */}
      <section className="border-t border-line-soft bg-cell">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-heading">About the gallery</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-body">
            {settings?.aboutTeaser ??
              "Every work is catalogued in depth — maker, period, provenance and condition — and can be seen in person by appointment."}
          </p>
          <Link
            href="/about"
            className="mt-4 inline-block text-sm text-ink-mid underline decoration-ink-separator underline-offset-4 hover:text-ink-strong"
          >
            Read more about us
          </Link>
        </div>
      </section>
    </>
  );
}

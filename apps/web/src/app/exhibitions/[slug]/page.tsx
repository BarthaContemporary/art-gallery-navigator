import type { Metadata } from "next";
import Image from "next/image";
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
import { JsonLd } from "@/components/json-ld";
import { PortableText } from "@/components/portable-text";
import { WorkGrid } from "@/components/work-card";
import { formatExhibitionDates } from "@/components/exhibition-card";

async function getExhibition(slug: string): Promise<Exhibition | null> {
  return sanityFetch<Exhibition | null>({
    query: exhibitionBySlugQuery,
    params: { slug },
    tags: ["exhibition", "work"],
    fallback: null,
  });
}

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({
    query: exhibitionSlugsQuery,
    tags: ["exhibition"],
    fallback: [],
  });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exhibition = await getExhibition(slug);
  if (!exhibition) return { title: "Exhibition not found" };

  const dates = formatExhibitionDates(exhibition.startDate, exhibition.endDate);
  const title = exhibition.seo?.title ?? exhibition.title ?? "Exhibition";
  const description =
    exhibition.seo?.description ??
    ([exhibition.subtitle, exhibition.venue, dates].filter(Boolean).join(" · ") ||
      undefined);
  const ogImage =
    imageUrl(exhibition.seo?.ogImage, { width: 1200 }) ??
    imageUrl(exhibition.coverImage, { width: 1200 });

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/exhibitions/${slug}`) },
    openGraph: {
      title,
      description,
      type: "article",
      url: absoluteUrl(`/exhibitions/${slug}`),
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function ExhibitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [exhibition, settings] = await Promise.all([
    getExhibition(slug),
    getSiteSettings(),
  ]);
  if (!exhibition) notFound();

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const dates = formatExhibitionDates(exhibition.startDate, exhibition.endDate);
  const works = (exhibition.works ?? []).filter((w) => w?.slug);
  const coverSrc = imageUrl(exhibition.coverImage, { width: 2000 });
  const pageUrl = absoluteUrl(`/exhibitions/${slug}`);
  const venueLine = exhibition.isArtFair
    ? [exhibition.fairName, exhibition.venue].filter(Boolean).join(" · ")
    : exhibition.venue;

  const eventJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: exhibition.title ?? "Exhibition",
    url: pageUrl,
    startDate: exhibition.startDate ?? undefined,
    endDate: exhibition.endDate ?? undefined,
    description: exhibition.subtitle ?? undefined,
    image: coverSrc ?? undefined,
    organizer: { "@type": "ArtGallery", name: galleryName, url: absoluteUrl("/") },
  };
  if (venueLine) {
    eventJsonLd.location = { "@type": "Place", name: venueLine };
  }

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={eventJsonLd} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/exhibitions" className="hover:text-ink-strong">
              Exhibitions
            </Link>
          </li>
          <li aria-hidden className="text-ink-separator">
            /
          </li>
          <li aria-current="page" className="text-ink-mid">
            {exhibition.title}
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        {exhibition.isArtFair ? (
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
            Art fair
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          {exhibition.title}
        </h1>
        {exhibition.subtitle ? (
          <p className="mt-2 text-lg text-ink-muted">{exhibition.subtitle}</p>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {venueLine ? <span>{venueLine}</span> : null}
          {dates ? (
            <span className="font-mono text-xs tracking-tight text-ink-soft">
              {dates}
            </span>
          ) : null}
        </p>
      </header>

      {coverSrc ? (
        <figure className="mt-8 overflow-hidden rounded-hero bg-placeholder">
          <Image
            src={coverSrc}
            alt={exhibition.coverImage?.caption ?? exhibition.title ?? "Exhibition"}
            width={2000}
            height={1333}
            priority
            sizes="(min-width: 1152px) 72rem, 100vw"
            className="h-auto w-full object-cover"
          />
        </figure>
      ) : null}

      {exhibition.intro && exhibition.intro.length > 0 ? (
        <div className="mt-8">
          <PortableText value={exhibition.intro} />
        </div>
      ) : null}

      {works.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.16em] text-ink-label-soft">
            Works in the exhibition
          </h2>
          <WorkGrid works={works} />
        </section>
      ) : null}
    </article>
  );
}

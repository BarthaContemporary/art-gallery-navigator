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
import { CatalogueGrid } from "@/components/catalogue-grid";
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
  const catalogue = (exhibition.catalogue ?? []).filter((e) => e?.image);
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
    <article className="py-10">
      <JsonLd data={eventJsonLd} />

      <div className="page">
        <nav aria-label="Breadcrumb" className="label mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/exhibitions" className="hover:text-oranje">
                Exhibitions
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">{exhibition.title}</li>
          </ol>
        </nav>

        <header className="max-w-[var(--measure)]">
          {exhibition.isArtFair ? (
            <p className="label mb-3">Art fair</p>
          ) : null}
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            {exhibition.title}
          </h1>
          {exhibition.subtitle ? (
            <p className="mt-3 font-serif text-lead font-light text-ink-70">
              {exhibition.subtitle}
            </p>
          ) : null}
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-ui text-ink-50">
            {venueLine ? <span>{venueLine}</span> : null}
            {dates ? <span>{dates}</span> : null}
          </p>
        </header>
      </div>

      {/* Full-bleed hero — caption below, never overlaid. */}
      {coverSrc ? (
        <figure className="mt-10">
          <div className="relative h-[72vh] w-full bg-washi-2">
            <Image
              src={coverSrc}
              alt={exhibition.coverImage?.caption ?? exhibition.title ?? "Exhibition"}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
          {exhibition.coverImage?.caption ? (
            <figcaption className="page label mt-3">
              {exhibition.coverImage.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="page">
        {exhibition.intro && exhibition.intro.length > 0 ? (
          <div className="mt-[var(--section)]">
            <PortableText value={exhibition.intro} />
          </div>
        ) : null}

        {works.length > 0 ? (
          <section className="mt-[var(--section)]">
            <div className="section-head grid12">
              <span className="label col-span-2 text-oranje md:col-span-1">
                01
              </span>
              <h2 className="label col-span-10 text-sumi md:col-span-11">
                Works in the exhibition
              </h2>
            </div>
            <div className="mt-12">
              <WorkGrid works={works} />
            </div>
          </section>
        ) : null}

        {catalogue.length > 0 ? (
          <section className="mt-[var(--section)]">
            <div className="section-head grid12">
              <span className="label col-span-2 text-oranje md:col-span-1">
                {works.length > 0 ? "02" : "01"}
              </span>
              <h2 className="label col-span-10 text-sumi md:col-span-11">
                {works.length > 0 ? "Catalogue" : "Works in the exhibition"}
              </h2>
            </div>
            <div className="mt-12">
              <CatalogueGrid entries={catalogue} />
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

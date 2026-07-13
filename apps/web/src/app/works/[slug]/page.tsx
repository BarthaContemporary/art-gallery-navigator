import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSiteSettings,
  imageDimensions,
  imageUrl,
  sanityFetch,
  workBySlugQuery,
  type Work,
} from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { workImageAlt } from "@/components/work-card";

const IMAGE_ROLE_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
  signature: "Signature",
  box: "Box",
  detail: "Detail",
  condition: "Condition",
};

async function getWork(slug: string): Promise<Work | null> {
  return sanityFetch<Work | null>({
    query: workBySlugQuery,
    params: { slug },
    tags: ["work"],
    fallback: null,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const work = await getWork(slug);
  if (!work) return { title: "Work not found" };

  const title = [work.title ?? "Untitled", work.maker].filter(Boolean).join(" — ");
  const description = [
    work.maker,
    work.period,
    work.originRegion,
    work.medium,
    work.dimensionsDisplay,
  ]
    .filter(Boolean)
    .join(" · ");
  const ogImage = imageUrl(work.images?.[0], { width: 1200 });

  return {
    title,
    description: description || undefined,
    alternates: { canonical: absoluteUrl(`/works/${slug}`) },
    openGraph: {
      title,
      description: description || undefined,
      type: "article",
      url: absoluteUrl(`/works/${slug}`),
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [work, settings] = await Promise.all([getWork(slug), getSiteSettings()]);
  if (!work) notFound();

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const enquiryEmail = settings?.email ?? "";
  const images = work.images ?? [];
  const hero = images[0] ?? null;
  const heroSrc = imageUrl(hero, { width: 1800 });
  const heroDims = imageDimensions(hero);
  const pageUrl = absoluteUrl(`/works/${slug}`);

  const specs: [string, string | null | undefined, boolean?][] = [
    ["Stock number", work.stockNumber, true],
    ["Maker", [work.maker, work.makerLifeDates].filter(Boolean).join(", ")],
    ["Period", work.period],
    ["Origin", work.originRegion],
    ["Medium", work.medium],
    ["Dimensions", work.dimensionsDisplay],
    ["Price", work.priceDisplay ?? "POA"],
    ["Availability", work.available === false ? "Sold" : "Available"],
  ];

  const artworkJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: work.title ?? "Untitled",
    url: pageUrl,
    identifier: work.stockNumber ?? undefined,
    creator: work.maker
      ? { "@type": "Person", name: work.maker, description: work.makerLifeDates ?? undefined }
      : undefined,
    artMedium: work.medium ?? undefined,
    dateCreated: work.period ?? undefined,
    countryOfOrigin: work.originRegion ?? undefined,
    size: work.dimensionsDisplay ?? undefined,
    description: work.description ?? undefined,
    image: heroSrc ?? undefined,
    provider: { "@type": "ArtGallery", name: galleryName },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: galleryName, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Works", item: absoluteUrl("/works") },
      { "@type": "ListItem", position: 3, name: work.title ?? "Untitled", item: pageUrl },
    ],
  };

  const enquirySubject = encodeURIComponent(
    `Enquiry: ${work.title ?? "Untitled"}${work.stockNumber ? ` (${work.stockNumber})` : ""}`,
  );

  return (
    <article className="page py-10">
      <JsonLd data={artworkJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <nav aria-label="Breadcrumb" className="label mb-8">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/works" className="hover:text-oranje">
              Works
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{work.title ?? "Untitled"}</li>
        </ol>
      </nav>

      <div className="grid12">
        {/* Imagery — catalogue plate on washi-2, object contained, generous pad. */}
        <div className="col-span-12 lg:col-span-7">
          <figure>
            <div className="relative aspect-[4/5] w-full bg-washi-2">
              {heroSrc && heroDims ? (
                <Image
                  src={heroSrc}
                  alt={workImageAlt(work, hero?.caption)}
                  fill
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-contain p-[clamp(40px,6vw,96px)]"
                />
              ) : (
                <span className="label absolute inset-0 flex items-center justify-center text-ink-50">
                  Image forthcoming
                </span>
              )}
            </div>
            {hero?.caption ? (
              <figcaption className="label mt-3">{hero.caption}</figcaption>
            ) : null}
          </figure>

          {images.length > 1 ? (
            <ul className="mt-6 grid grid-cols-3 gap-6 sm:grid-cols-4">
              {images.slice(1).map((image) => {
                const src = imageUrl(image, { width: 600 });
                if (!src) return null;
                const label = image.role ? IMAGE_ROLE_LABELS[image.role] : null;
                return (
                  <li key={image._key ?? src}>
                    <figure>
                      <div className="relative aspect-square w-full bg-washi-2">
                        <Image
                          src={src}
                          alt={image.caption ?? label ?? workImageAlt(work)}
                          fill
                          sizes="(min-width: 1024px) 14vw, 30vw"
                          className="object-contain p-3"
                        />
                      </div>
                      {label || image.caption ? (
                        <figcaption className="label mt-2">
                          {image.caption ?? label}
                        </figcaption>
                      ) : null}
                    </figure>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Meta rail — sticky, cols 9–12. */}
        <div className="col-span-12 lg:col-span-3 lg:col-start-10">
          <div className="lg:sticky lg:top-28">
            <header>
              {work.maker ? (
                <p className="font-sans text-ui text-ink-70">
                  {work.maker}
                  {work.makerLifeDates ? (
                    <span className="text-ink-50"> ({work.makerLifeDates})</span>
                  ) : null}
                </p>
              ) : null}
              <h1 className="mt-1 font-sans text-h2 font-medium tracking-tight text-sumi">
                {work.title ?? "Untitled"}
              </h1>
              <p className="label mt-3">
                {work.available === false ? "Sold" : "Available"}
                {work.stockNumber ? ` · ${work.stockNumber}` : ""}
              </p>
            </header>

            {/* MetaTable — sumi top rule, label-caps keys, serif values. */}
            <dl className="mt-8 border-t border-sumi">
              {specs.map(([label, value]) =>
                value ? (
                  <div
                    key={label}
                    className="grid grid-cols-[7rem_1fr] gap-4 border-b border-hairline py-3"
                  >
                    <dt className="label">{label}</dt>
                    <dd className="font-serif text-ui text-ink-70">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>

            {work.description ? (
              <div className="mt-8">
                <h2 className="label">Description</h2>
                <p className="mt-3 whitespace-pre-line font-serif text-body text-ink-70">
                  {work.description}
                </p>
              </div>
            ) : null}

            <div className="mt-10 flex flex-wrap gap-3">
              {enquiryEmail ? (
                <a
                  href={`mailto:${enquiryEmail}?subject=${enquirySubject}`}
                  className="btn btn-filled"
                >
                  Enquire about this work
                </a>
              ) : (
                <Link href="/contact" className="btn btn-filled">
                  Enquire about this work
                </Link>
              )}
              <Link href="/visit" className="btn">
                View in person
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

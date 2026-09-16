import type { Metadata } from "next";
import Image from "next/image";
import { getSiteSettings, imageDimensions, imageUrl, pageBySlugQuery, sanityFetch, type SitePage } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { PortableText } from "@/components/portable-text";
import { AppointmentForm } from "@/components/appointment-form";

export const metadata: Metadata = {
  title: "About",
  description: "About the gallery — Japanese and Indian works of art in St James's, London. By appointment.",
};

/**
 * About (handoff 2g, adjusted): the gallery photo sits above the statement at
 * its own proportions rather than as a full-width header; statement headline
 * and paragraphs on the left; Visit (with the inline appointment request),
 * Contact and Press on the right. The footer's contact details live here
 * too, because the infinite-scroll pages make the footer hard to reach.
 */
export default async function AboutPage() {
  const [page, settings] = await Promise.all([
    sanityFetch<SitePage | null>({ query: pageBySlugQuery, params: { slug: "about" }, tags: ["page"], fallback: null }),
    getSiteSettings(),
  ]);

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  // The old About page carried its photograph inside the body; the site
  // settings photo replaces it, so image blocks are dropped from the fallback.
  const fallbackBody = (page?.body ?? []).filter((b) => b._type !== "image");
  const statement = settings?.statement?.length ? settings.statement : fallbackBody.length ? fallbackBody : null;
  const headline = settings?.statementHeadline ?? page?.title ?? null;
  const addressLines = (settings?.address ?? "St James's, London").split(/\n/).map((l) => l.trim()).filter(Boolean);
  const visitNote = settings?.visitNote ?? settings?.openingHours ?? "By appointment only";
  const press = (settings?.pressLinks ?? []).filter((l) => l?.url && l?.title);
  const phoneHref = settings?.phone ? `tel:${settings.phone.replace(/[^\d+]/g, "")}` : null;

  const photoSrc = imageUrl(settings?.galleryPhoto, { width: 1400 });
  const photoDims = imageDimensions(settings?.galleryPhoto);

  return (
    <article>
      <div className="page pt-12 pb-24 md:pt-16">
        {/* The heading sits above both columns so Visit aligns with the photo's top edge. */}
        {headline ? <h1 className="t-title">{headline}</h1> : <h1 className="t-title">{galleryName}</h1>}
        <div className="mt-6 grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-16">
          <section className="max-w-[640px]">
            {photoSrc && photoDims ? (
              <Image
                src={photoSrc}
                alt={settings?.galleryPhoto?.caption ?? `${galleryName} gallery`}
                width={photoDims.width}
                height={photoDims.height}
                sizes="(min-width: 768px) 640px, 100vw"
                priority
                className="h-auto w-full bg-field"
              />
            ) : null}
            <div className="mt-6">
              {statement ? (
                <PortableText value={statement} />
              ) : (
                <div className="flex flex-col gap-5 font-sans text-body text-body">
                  <p>
                    {settings?.aboutTeaser ??
                      `${galleryName} deals in Japanese and Indian works of art, from tantric drawings and bronzes to Mingei and twentieth-century Japanese design.`}
                  </p>
                  <p>
                    The gallery is in St James&rsquo;s, London, and opens by appointment. We are always pleased to share further
                    photography, condition notes and research on any work.
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-12">
            <section>
              <h2 className="label">Visit</h2>
              <address className="mt-3 font-sans text-body not-italic text-body">
                {addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
                <span className="mt-2 block text-meta">{visitNote}</span>
              </address>
              <div className="mt-3">
                <AppointmentForm />
              </div>
            </section>

            <section>
              <h2 className="label">Contact</h2>
              <ul className="mt-3 flex flex-col font-sans text-body">
                {settings?.phone && phoneHref ? (
                  <li>
                    <a href={phoneHref} className="inline-flex min-h-[40px] items-center text-body hover:text-accent">
                      {settings.phone}
                    </a>
                  </li>
                ) : null}
                {settings?.email ? (
                  <li>
                    <a href={`mailto:${settings.email}`} className="inline-flex min-h-[40px] items-center text-body hover:text-accent">
                      {settings.email}
                    </a>
                  </li>
                ) : null}
                {settings?.instagram ? (
                  <li>
                    <a
                      href={settings.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center text-body hover:text-accent"
                    >
                      Instagram ↗
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>

            {press.length > 0 ? (
              <section>
                <h2 className="label">Press</h2>
                <ul className="mt-3 flex flex-col">
                  {press.map((l) => (
                    <li key={l._key}>
                      <a
                        href={l.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-2 font-sans text-body text-body hover:text-accent"
                      >
                        <span>{l.title}</span>
                        {l.source ? <span className="text-meta">{l.source}</span> : null}
                        <span aria-hidden className="text-meta">
                          ↗
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

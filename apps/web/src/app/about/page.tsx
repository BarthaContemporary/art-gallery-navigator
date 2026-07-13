import type { Metadata } from "next";
import { getSiteSettings, pageBySlugQuery, sanityFetch, type SitePage } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { PortableText } from "@/components/portable-text";

export const metadata: Metadata = {
  title: "About",
  description: "About the gallery — dealing in Japanese and Indian works of art.",
};

export default async function AboutPage() {
  const [page, settings] = await Promise.all([
    sanityFetch<SitePage | null>({
      query: pageBySlugQuery,
      params: { slug: "about" },
      tags: ["page"],
      fallback: null,
    }),
    getSiteSettings(),
  ]);

  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  return (
    <div className="page py-16">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            {page?.title ?? "About"}
          </h1>

          {page?.body?.length ? (
            <div className="mt-10">
              <PortableText value={page.body} />
            </div>
          ) : (
            <div className="mt-10 max-w-[var(--measure)] space-y-5 font-serif text-body text-ink-70">
              <p>
                {settings?.aboutTeaser ??
                  `${galleryName} deals in Japanese and Indian works of art — bronzes, metalwork, okimono and fine objects — chosen for quality of making and honesty of condition.`}
              </p>
              <p>
                Every work is catalogued in depth: maker, period, medium, dimensions
                and, where it is known, provenance. We are always pleased to share
                further photography, condition notes and research on request.
              </p>
              <p>
                The gallery is open by appointment. Visits can be arranged through the{" "}
                <a href="/visit" className="link-inline">
                  booking page
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

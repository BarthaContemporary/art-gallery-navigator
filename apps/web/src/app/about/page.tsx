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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
        {page?.title ?? "About"}
      </h1>

      {page?.body?.length ? (
        <div className="mt-4">
          <PortableText value={page.body} />
        </div>
      ) : (
        <div className="mt-4 max-w-2xl space-y-4 leading-relaxed text-ink-body">
          <p>
            {settings?.aboutTeaser ??
              `${galleryName} deals in Japanese and Indian works of art — bronzes, metalwork, okimono and fine objects — chosen for quality of making and honesty of condition.`}
          </p>
          <p>
            Every work is catalogued in depth: maker, period, medium, dimensions and, where it is
            known, provenance. We are always pleased to share further photography, condition notes
            and research on request.
          </p>
          <p>
            The gallery is open by appointment. Visits can be arranged through the{" "}
            <a href="/visit" className="underline decoration-ink-separator underline-offset-2 hover:text-ink-strong">
              booking page
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

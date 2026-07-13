import type { Metadata } from "next";
import { exhibitionsQuery, sanityFetch, type Exhibition } from "@/lib/sanity";
import { PortableText } from "@/components/portable-text";
import { WorkGrid } from "@/components/work-card";

export const metadata: Metadata = {
  title: "Exhibitions",
  description: "Current, forthcoming and past exhibitions and fair presentations.",
};

function formatDates(start: string | null, end: string | null): string | null {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const s = start ? fmt.format(new Date(start)) : null;
  const e = end ? fmt.format(new Date(end)) : null;
  if (s && e) return `${s} – ${e}`;
  return s ?? e;
}

export default async function ExhibitionsPage() {
  const exhibitions = await sanityFetch<Exhibition[]>({
    query: exhibitionsQuery,
    tags: ["exhibition", "work"],
    fallback: [],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Exhibitions</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Gallery exhibitions and fair presentations, past and forthcoming.
        </p>
      </header>

      {exhibitions.length === 0 ? (
        <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
          Exhibition announcements will appear here.
        </p>
      ) : (
        <div className="space-y-16">
          {exhibitions.map((exhibition) => {
            const dates = formatDates(exhibition.startDate, exhibition.endDate);
            const works = (exhibition.works ?? []).filter((w) => w?.slug);
            return (
              <article
                key={exhibition._id}
                className="border-t border-line-soft pt-10 first:border-t-0 first:pt-0"
              >
                <header>
                  <h2 className="text-xl font-semibold text-ink-heading">{exhibition.title}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {[exhibition.venue, dates].filter(Boolean).join(" · ")}
                  </p>
                </header>
                <div className="mt-4">
                  <PortableText value={exhibition.body} />
                </div>
                {works.length > 0 ? (
                  <div className="mt-8">
                    <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-ink-label-soft">
                      Works shown
                    </h3>
                    <WorkGrid works={works} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

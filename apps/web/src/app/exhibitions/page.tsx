import type { Metadata } from "next";
import {
  exhibitionsQuery,
  sanityFetch,
  type ExhibitionListItem,
} from "@/lib/sanity";
import { ExhibitionCard, isCurrentExhibition } from "@/components/exhibition-card";

export const metadata: Metadata = {
  title: "Exhibitions",
  description:
    "Current and past exhibitions and art-fair presentations of Indian and Japanese art.",
};

export default async function ExhibitionsPage() {
  const exhibitions = await sanityFetch<ExhibitionListItem[]>({
    query: exhibitionsQuery,
    tags: ["exhibition"],
    fallback: [],
  });

  const current = exhibitions.filter((e) => isCurrentExhibition(e));
  const past = exhibitions.filter((e) => !isCurrentExhibition(e));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-12 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Exhibitions
        </h1>
        <p className="mt-3 leading-relaxed text-ink-muted">
          Gallery exhibitions and art-fair presentations of Indian and Japanese
          art — current and past.
        </p>
      </header>

      {exhibitions.length === 0 ? (
        <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
          Exhibition announcements will appear here.
        </p>
      ) : (
        <div className="space-y-16">
          {current.length > 0 ? (
            <Section title="Current & forthcoming" items={current} />
          ) : null}
          {past.length > 0 ? <Section title="Past" items={past} /> : null}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: ExhibitionListItem[];
}) {
  return (
    <section>
      <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.16em] text-ink-label-soft">
        {title}
      </h2>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((exhibition) => (
          <li key={exhibition._id}>
            <ExhibitionCard exhibition={exhibition} />
          </li>
        ))}
      </ul>
    </section>
  );
}

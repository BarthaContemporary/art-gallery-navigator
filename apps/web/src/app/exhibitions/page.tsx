import type { Metadata } from "next";
import {
  exhibitionsQuery,
  sanityFetch,
  type ExhibitionListItem,
} from "@/lib/sanity";
import {
  ExhibitionHero,
  ExhibitionRow,
  isCurrentExhibition,
} from "@/components/exhibition-card";

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
  const [featured, ...restCurrent] = current;

  return (
    <div className="page py-16">
      <header className="grid12">
        <div className="col-span-12 md:col-span-8">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Exhibitions
          </h1>
          <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
            Gallery exhibitions and art-fair presentations of Indian and Japanese
            art — current and past.
          </p>
        </div>
      </header>

      {exhibitions.length === 0 ? (
        <p className="mt-16 py-12 font-serif text-body text-ink-50">
          Exhibition announcements will appear here.
        </p>
      ) : (
        <>
          {featured ? (
            <div className="mt-16">
              <ExhibitionHero exhibition={featured} />
            </div>
          ) : null}

          {restCurrent.length > 0 ? (
            <Section title="Current & forthcoming" items={restCurrent} index="01" />
          ) : null}
          {past.length > 0 ? (
            <Section title="Past" items={past} index={restCurrent.length > 0 ? "02" : "01"} />
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  index,
}: {
  title: string;
  items: ExhibitionListItem[];
  index: string;
}) {
  return (
    <section className="mt-[var(--section)]">
      <div className="section-head grid12">
        <span className="label col-span-2 text-oranje md:col-span-1">
          {index}
        </span>
        <h2 className="label col-span-10 text-sumi md:col-span-11">{title}</h2>
      </div>
      <ul className="mt-8">
        {items.map((exhibition) => (
          <li key={exhibition._id}>
            <ExhibitionRow exhibition={exhibition} />
          </li>
        ))}
      </ul>
    </section>
  );
}

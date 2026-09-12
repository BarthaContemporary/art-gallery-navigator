import { imageUrl, type CatalogueEntry } from "@/lib/sanity";
import { ImageFrame } from "@/components/work-card";

/**
 * The works of a past exhibition, as catalogue entries owned by the CMS.
 * Same frame and rhythm as the inventory WorkGrid, but nothing links
 * anywhere — these records describe what was shown, not what is for sale.
 */
export function CatalogueGrid({ entries }: { entries: CatalogueEntry[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const src = imageUrl(entry.image, { width: 900 });
        const alt =
          entry.image?.caption ??
          [entry.title, entry.maker, entry.originAndDate].filter(Boolean).join(", ") ??
          "Catalogue image";
        const makerLine = entry.maker
          ? entry.makerDates
            ? `${entry.maker} (${entry.makerDates})`
            : entry.maker
          : null;
        return (
          <li key={entry._key}>
            <ImageFrame
              src={src}
              alt={alt || "Catalogue image"}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
            <div className="mt-4 space-y-1">
              {makerLine ? (
                <p className="font-sans text-ui font-medium text-sumi">{makerLine}</p>
              ) : null}
              {entry.title ? (
                <p
                  className={`font-serif text-ui ${makerLine ? "text-ink-70" : "font-sans font-medium text-sumi"}`}
                >
                  {entry.title}
                </p>
              ) : null}
              {entry.medium ? (
                <p className="font-serif text-ui text-ink-70">{entry.medium}</p>
              ) : null}
              {entry.originAndDate ? (
                <p className="font-serif text-ui text-ink-70">{entry.originAndDate}</p>
              ) : null}
              {entry.dimensions ? (
                <p className="font-serif text-ui text-ink-50">{entry.dimensions}</p>
              ) : null}
              {entry.reference || entry.sold ? (
                <p className="label flex gap-3 pt-1">
                  {entry.reference ? <span>{entry.reference}</span> : null}
                  {entry.sold ? <span className="text-oranje">Sold</span> : null}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

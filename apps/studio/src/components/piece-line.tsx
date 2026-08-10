import { titleWithYear } from "@jvb/db";

/**
 * A work as it appears in a satellite list — attaching to a shipment, picking
 * for an offer. Thumbnail, stock number, title with year, maker: enough to be
 * sure it is the right object without opening the record, which is the whole
 * job when the list is the thing you are choosing from.
 *
 * Deliberately the same shape as the inventory list's mobile card, so a work
 * looks the same wherever it is being picked.
 */
export function PieceLine({
  stockNumber,
  title,
  year,
  makerName,
  thumbUrl,
}: {
  stockNumber: string | null;
  title: string | null;
  year: number | string | null;
  makerName?: string | null;
  thumbUrl?: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          aria-label="No image"
          className="jvb-hatch flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] text-ink-soft"
        >
          ▦
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink-body">
          <span className="font-mono text-[12px] text-ink-muted">{stockNumber ?? "—"}</span>{" "}
          {titleWithYear(title, year)}
        </span>
        {makerName ? (
          <span className="block truncate text-[12px] text-ink-soft">{makerName}</span>
        ) : null}
      </span>
    </span>
  );
}

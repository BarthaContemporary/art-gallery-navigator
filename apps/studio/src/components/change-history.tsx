"use client";

/** Admin-only per-object change log rendered from the activity_log diff. */

// Pinned to London time: the server render (UTC) and the browser (local) used
// to print different times for the same entry, an hour apart in summer.
import { EMPTY, formatCount, formatDate, formatDateTime, gbpDisplay, gbpExact } from "@/lib/format";
import { ACTIVITY_ACTION_LABELS, FIELD_LABELS, FIELD_VALUE_LABELS, labelOf } from "@/lib/labels";
import { ArrowRightIcon } from "@/components/ui/icons";

type Change = { old?: unknown; new?: unknown };

export type HistoryEntry = {
  id: number | string;
  action: string;
  created_at: string;
  actor: string | null;
  entityType: string | null;
  changes: Record<string, unknown> | null;
};

const ENTITY_LABEL: Record<string, string> = {
  pieces: "Record",
  external_pieces: "Record",
  piece_financials: "Financials",
};

/** Amounts in the purchase or sale currency, which a separate column names. */
const FOREIGN_AMOUNTS = new Set(["purchase_cost", "sold_price"]);
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/**
 * One stored value as the studio shows it elsewhere: enum values in words,
 * £ columns as money (to the penny only when there are pence, so a change of
 * pence still shows), days and times in the short form without seconds, a
 * linked maker, category, location or contact by its name.
 */
function formatValue(key: string, v: unknown, names: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return EMPTY;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const words = FIELD_VALUE_LABELS[key];
  if (words && typeof v === "string") return labelOf(words, v);
  if (key.endsWith("_id") && typeof v === "string") return names[v] ?? "Linked record";
  if (key.endsWith("_gbp")) {
    const n = Number(v);
    if (Number.isFinite(n)) return Number.isInteger(n) ? gbpDisplay(n) : gbpExact(n);
  }
  if (key === "consignment_share_pct" && Number.isFinite(Number(v))) return `${Number(v)}%`;
  if (FOREIGN_AMOUNTS.has(key) && Number.isFinite(Number(v))) return formatCount(Number(v));
  if (typeof v === "string") {
    if (CALENDAR_DAY.test(v)) return formatDate(v, "short");
    if (INSTANT.test(v)) return formatDateTime(v, "short");
    return v;
  }
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) {
    return v.length ? v.join(", ") : EMPTY;
  }
  return JSON.stringify(v);
}

function trunc(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function ChangeHistory({
  entries,
  revertAction,
  names = {},
}: {
  entries: HistoryEntry[];
  revertAction?: (formData: FormData) => void | Promise<void>;
  /** Names for the ids a change refers to (maker, category, location, contact). */
  names?: Record<string, string>;
}) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-meta">No changes recorded.</p>;
  }

  return (
    // A capped, scrolling list: an old record can carry hundreds of edits.
    // data-inset-focus keeps the focus ring inside the scroll frame.
    <div data-inset-focus className="max-h-[440px] overflow-y-auto pr-1">
      {entries.map((e) => {
        const diffKeys =
          e.action === "UPDATE" && e.changes
            ? Object.keys(e.changes).filter((k) => k !== "new" && k !== "old")
            : [];
        return (
          <div key={e.id} className="border-t border-rule py-2.5 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-medium text-ink">
                {labelOf(ACTIVITY_ACTION_LABELS, e.action)}
                <span className="font-normal text-meta">
                  {" · "}
                  {ENTITY_LABEL[e.entityType ?? ""] ?? e.entityType ?? ""}
                </span>
              </span>
              <span className="tabular text-[12px] text-meta">{formatDateTime(e.created_at, "short")}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-meta">
              by {e.actor?.trim() ? e.actor : "System"}
            </p>
            {diffKeys.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {diffKeys.map((k) => {
                  const c = e.changes?.[k] as Change | undefined;
                  const label = labelOf(FIELD_LABELS, k);
                  return (
                    <li key={k} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 text-[12px] leading-[1.45]">
                      <span className="truncate text-meta" title={label}>
                        {label}
                      </span>
                      <span className="min-w-0 break-words text-body">
                        <span className="sr-only">changed from </span>
                        <span className="text-meta line-through">{trunc(formatValue(k, c?.old, names))}</span>
                        <ArrowRightIcon size={12} className="mx-1 inline-block align-[-1px] text-meta" />
                        <span className="sr-only">to </span>
                        <span className="text-ink">{trunc(formatValue(k, c?.new, names))}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {revertAction && e.action === "UPDATE" && diffKeys.length > 0 ? (
              <form
                action={revertAction}
                className="mt-1.5"
                onSubmit={(ev) => {
                  if (
                    !window.confirm(
                      "Reinstate the previous values for this change? The current values will be overwritten (this is itself recorded).",
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="entry_id" value={String(e.id)} />
                <button type="submit" className="link text-[12px]">
                  Reinstate previous values
                </button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

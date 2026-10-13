"use client";

/** Admin-only per-object change log rendered from the activity_log diff. */

// Pinned to London time: the server render (UTC) and the browser (local) used
// to print different times for the same entry, an hour apart in summer.
import { formatDateTime } from "@/lib/format";

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
  piece_financials: "Financials",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Edited",
  DELETE: "Deleted",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function trunc(s: string, n = 80): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function ChangeHistory({
  entries,
  revertAction,
}: {
  entries: HistoryEntry[];
  revertAction?: (formData: FormData) => void | Promise<void>;
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
                {ACTION_LABEL[e.action] ?? e.action}
                <span className="font-normal text-meta">
                  {" · "}
                  {ENTITY_LABEL[e.entityType ?? ""] ?? e.entityType ?? ""}
                </span>
              </span>
              <span className="tabular text-[12px] text-meta">
                {formatDateTime(e.created_at, "numeric", { seconds: true })}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-meta">
              by {e.actor?.trim() ? e.actor : "System"}
            </p>
            {diffKeys.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {diffKeys.map((k) => {
                  const c = e.changes?.[k] as Change | undefined;
                  return (
                    <li key={k} className="grid grid-cols-[minmax(0,8rem)_1fr] gap-3 text-[12px] leading-[1.45]">
                      <span className="truncate text-meta">{k.replace(/_/g, " ")}</span>
                      <span className="min-w-0 break-words text-body">
                        <span className="text-meta line-through">{trunc(fmt(c?.old))}</span>
                        <span className="text-meta"> → </span>
                        <span className="text-ink">{trunc(fmt(c?.new))}</span>
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

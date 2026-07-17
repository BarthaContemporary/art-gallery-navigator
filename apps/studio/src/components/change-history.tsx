"use client";

/** Admin-only per-object change log rendered from the activity_log diff. */

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
    return <p className="mt-3 text-[12.5px] text-ink-soft">No changes recorded.</p>;
  }

  return (
    <div className="mt-3 max-h-[440px] space-y-3 overflow-y-auto pr-1">
      {entries.map((e) => {
        const diffKeys =
          e.action === "UPDATE" && e.changes
            ? Object.keys(e.changes).filter((k) => k !== "new" && k !== "old")
            : [];
        return (
          <div key={e.id} className="rounded-[9px] border border-line-soft bg-cell px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[12.5px] font-medium text-ink-body">
                {ACTION_LABEL[e.action] ?? e.action}
                <span className="text-ink-faint">
                  {" · "}
                  {ENTITY_LABEL[e.entityType ?? ""] ?? e.entityType ?? ""}
                </span>
              </span>
              <span className="font-mono text-[11px] text-ink-soft">
                {new Date(e.created_at).toLocaleString("en-GB")}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-soft">
              by {e.actor?.trim() ? e.actor : "System"}
            </p>
            {diffKeys.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-line-soft pt-2">
                {diffKeys.map((k) => {
                  const c = e.changes?.[k] as Change | undefined;
                  return (
                    <li key={k} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2 text-[12px]">
                      <span className="truncate text-ink-faint">{k.replace(/_/g, " ")}</span>
                      <span className="min-w-0 text-ink-body">
                        <span className="text-ink-soft line-through">{trunc(fmt(c?.old))}</span>
                        <span className="text-ink-faint"> → </span>
                        <span>{trunc(fmt(c?.new))}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {revertAction && e.action === "UPDATE" && diffKeys.length > 0 ? (
              <form
                action={revertAction}
                className="mt-2 border-t border-line-soft pt-2"
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
                <button
                  type="submit"
                  className="text-[11.5px] font-medium text-oranje hover:underline"
                >
                  ↩ Reinstate previous values
                </button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

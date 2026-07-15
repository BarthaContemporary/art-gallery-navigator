"use client";

import { useMemo, useState } from "react";

type Option = { id: string; label: string };

const input =
  "w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink-body";

/**
 * Searchable maker picker. Filters the full maker list client-side so a long
 * dropdown becomes a type-to-find box. Submits the chosen id as `maker_id`.
 */
export function MakerSelect({
  options,
  defaultId,
}: {
  options: Option[];
  defaultId?: string | null;
}) {
  const [id, setId] = useState(defaultId ?? "");
  const [searching, setSearching] = useState(!(defaultId ?? ""));
  const [q, setQ] = useState("");

  const selected = options.find((o) => o.id === id) ?? null;

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
    return base.slice(0, 50);
  }, [q, options]);

  const pick = (o: Option) => {
    setId(o.id);
    setSearching(false);
    setQ("");
  };

  return (
    <div className="mt-1.5">
      <input type="hidden" name="maker_id" value={id} />

      {id && selected && !searching ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-control px-2.5 py-0.5 text-[12.5px] text-ink-body">
            {selected.label}
            <button
              type="button"
              onClick={() => {
                setId("");
                setSearching(true);
              }}
              aria-label="Clear maker"
              className="text-ink-muted hover:text-oranje"
            >
              ×
            </button>
          </span>
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="text-[12px] text-oranje"
          >
            change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search makers…"
            className={input}
          />
          {q.trim() ? (
            results.length > 0 ? (
              <ul className="mt-1 max-h-60 divide-y divide-line-control overflow-y-auto rounded-lg border border-line-control">
                {results.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => pick(o)}
                      className="block w-full px-3 py-2 text-left text-[13.5px] text-ink-body hover:bg-control"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[12px] text-ink-muted">No matching maker.</p>
            )
          ) : null}
          {id ? (
            <button
              type="button"
              onClick={() => setSearching(false)}
              className="mt-1 text-[12px] text-ink-muted hover:text-oranje"
            >
              cancel
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

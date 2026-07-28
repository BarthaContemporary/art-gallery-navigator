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
  const [opts, setOpts] = useState<Option[]>(options);
  const [id, setId] = useState(defaultId ?? "");
  const [searching, setSearching] = useState(!(defaultId ?? ""));
  const [q, setQ] = useState("");

  // Inline "add maker" — basic details only, so cataloguing never stops just
  // because the maker isn't on file yet.
  const [adding, setAdding] = useState(false);
  const [newDates, setNewDates] = useState("");
  const [newNative, setNewNative] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = opts.find((o) => o.id === id) ?? null;

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? opts.filter((o) => o.label.toLowerCase().includes(s)) : opts;
    return base.slice(0, 50);
  }, [q, opts]);

  const pick = (o: Option) => {
    setId(o.id);
    setSearching(false);
    setQ("");
    setAdding(false);
  };

  async function addMaker() {
    const name = q.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/makers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          life_dates: newDates.trim() || undefined,
          native_name: newNative.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { maker?: Option; error?: string };
      if (!res.ok || !json.maker) throw new Error(json.error ?? "Could not add maker");
      const opt = json.maker;
      setOpts((p) =>
        p.some((o) => o.id === opt.id)
          ? p
          : [...p, opt].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setNewDates("");
      setNewNative("");
      pick(opt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add maker");
    } finally {
      setBusy(false);
    }
  }

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
            <>
              {results.length > 0 ? (
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
              )}

              {/* Offer to create whatever was typed — the search box doubles as
                  the name field, so there is nothing to re-type. */}
              {adding ? (
                <div className="mt-2 rounded-lg border border-line-control bg-band/40 p-3">
                  <p className="text-[12.5px] text-ink-body">
                    Add <strong>{q.trim()}</strong> as a new maker
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={newDates}
                      onChange={(e) => setNewDates(e.target.value)}
                      placeholder="Life dates (optional) — e.g. 1854–1918"
                      className="min-w-0 flex-1 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body"
                    />
                    <input
                      value={newNative}
                      onChange={(e) => setNewNative(e.target.value)}
                      placeholder="Name in original script (optional)"
                      className="min-w-0 flex-1 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void addMaker()}
                      className="rounded-md border border-oranje bg-oranje/10 px-2.5 py-1 text-[12px] font-semibold text-oranje disabled:opacity-60"
                    >
                      {busy ? "Adding…" : "Add maker"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setError(null);
                      }}
                      className="text-[12px] text-ink-muted hover:text-ink-strong"
                    >
                      Cancel
                    </button>
                    <span className="text-[11.5px] text-ink-soft">
                      Biography and portrait can be added later on the maker&rsquo;s page.
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-1.5 text-[12px] font-medium text-oranje"
                >
                  + Add “{q.trim()}” as a new maker
                </button>
              )}
              {error ? <p className="mt-1 text-[12px] text-danger">{error}</p> : null}
            </>
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

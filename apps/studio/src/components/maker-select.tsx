"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nativeFieldLang } from "@/lib/script-lang";
import { Button } from "@/components/ui/button";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";

type Option = { id: string; label: string };

/**
 * Searchable maker picker. Filters the full maker list client-side so a long
 * dropdown becomes a type-to-find box. Submits the chosen id as `maker_id`.
 */
export function MakerSelect({
  id: inputId,
  options,
  defaultId,
}: {
  /** For the search box, so the form's "Maker" label names it. */
  id?: string;
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
  // The API links an existing maker of the same name (and dates) rather than
  // making a twin; say so, since otherwise "Add maker" looked like it had
  // created one. `separate` reopens the form to add a distinct maker instead.
  const [reused, setReused] = useState<{ name: string; label: string } | null>(null);
  const [separate, setSeparate] = useState(false);

  const selected = opts.find((o) => o.id === id) ?? null;

  // A hidden input's React value change does not emit a DOM event, so the
  // wrapping autosave form never hears about a maker being picked or created —
  // and worse, clicking a result blurs the search box first, which flushes a
  // save of the *previous* maker and reports "all changes saved". Nudge the
  // form once the new id is in the DOM, exactly as buyer-select.tsx does.
  const hiddenRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id]);

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
    setReused(null);
    setSeparate(false);
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
          // Only an explicit "Add a separate maker instead" may create a
          // second maker of the same name.
          separate: separate || undefined,
        }),
      });
      const json = (await res.json()) as { maker?: Option; reused?: boolean; error?: string };
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
      if (json.reused) setReused({ name, label: opt.label });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add maker");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={hiddenRef} type="hidden" name="maker_id" value={id} />

      {id && selected && !searching ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-[var(--jvb-control-h-sm)] items-center gap-1 border border-rule-strong pl-2.5 text-[13px] text-ink">
            {selected.label}
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              label="Clear maker"
              onClick={() => {
                setId("");
                setSearching(true);
              }}
            >
              <CloseIcon size={14} />
            </Button>
          </span>
          <button type="button" onClick={() => setSearching(true)} className="link text-[12px]">
            Change
          </button>
          {reused ? (
            <p role="status" className="w-full text-[12px] leading-[1.4] text-body">
              Linked to the existing maker “{reused.label}”.{" "}
              <button
                type="button"
                onClick={() => {
                  setQ(reused.name);
                  setSearching(true);
                  setAdding(true);
                  setSeparate(true);
                  setReused(null);
                }}
                className="link"
              >
                Add a separate maker instead
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search makers…"
            className="field"
          />
          {q.trim() ? (
            <>
              {results.length > 0 ? (
                <ul data-inset-focus className="mt-1 max-h-60 divide-y divide-rule overflow-y-auto border border-rule-strong">
                  {results.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => pick(o)}
                        className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-band"
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-meta">No matching maker.</p>
              )}

              {/* Offer to create whatever was typed: the search box doubles as
                  the name field, so there is nothing to re-type. */}
              {adding ? (
                <div className="panel mt-2 p-3">
                  <p className="text-[13px] text-body">
                    Add <strong className="font-semibold text-ink">{q.trim()}</strong> as a new maker
                  </p>
                  {separate ? (
                    <p className="mt-1 text-[12px] leading-[1.4] text-body">
                      A maker of this name is already on file. Give this one its
                      life dates so the two can be told apart.
                    </p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <label htmlFor={`${inputId ?? "maker"}-dates`} className="label">
                        Life dates (optional)
                      </label>
                      <input
                        id={`${inputId ?? "maker"}-dates`}
                        value={newDates}
                        onChange={(e) => setNewDates(e.target.value)}
                        placeholder="1854–1918"
                        className="field"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label htmlFor={`${inputId ?? "maker"}-native`} className="label">
                        Name in original script (optional)
                      </label>
                      <input
                        id={`${inputId ?? "maker"}-native`}
                        value={newNative}
                        onChange={(e) => setNewNative(e.target.value)}
                        lang={nativeFieldLang(newNative)}
                        className="field"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => void addMaker()} pending={busy} pendingLabel="Adding…">
                      Add maker
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => {
                        setAdding(false);
                        setSeparate(false);
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <span className="text-[12px] leading-[1.4] text-meta">
                      Biography and portrait can be added later on the maker&rsquo;s page.
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="link mt-1.5 inline-flex items-center gap-1 text-[12px]"
                >
                  <PlusIcon size={14} />
                  Add “{q.trim()}” as a new maker
                </button>
              )}
              {error ? (
                <p role="alert" className="mt-1 text-[12px] text-danger">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}
          {id ? (
            <Button variant="quiet" size="sm" onClick={() => setSearching(false)} className="mt-1 -ml-1.5">
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABELS } from "@/components/status-pill";

type Result = { id: string; name: string; email: string | null };

const input =
  "w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";

// Mirrors the status options in piece-form.tsx.
const STATUSES = Object.keys(STATUS_LABELS);
const label = (s: string) => STATUS_LABELS[s] ?? s.replace(/_/g, " ");

export function BuyerSelect({
  initialId,
  initialName,
}: {
  initialId?: string | null;
  initialName?: string | null;
}) {
  const [id, setId] = useState(initialId ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [searching, setSearching] = useState(!(initialId ?? ""));
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  // Status-change prompt shown after a buyer is picked on a not-yet-sold work.
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const [prompt, setPrompt] = useState<{ current: string } | null>(null);
  const [chosen, setChosen] = useState("sold");

  // Debounced search against the CRM contacts endpoint.
  useEffect(() => {
    if (!searching) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/crm/contacts/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((json: { results?: Result[] }) => {
          if (!cancelled) setResults(json.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, searching]);

  // A hidden input's React value change does not emit a DOM event, so nudge the
  // autosave form whenever the buyer changes (also covers the pick below).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id]);

  function statusSelect() {
    return rootRef.current
      ?.closest("form")
      ?.querySelector('select[name="status"]') as HTMLSelectElement | null;
  }

  // After a buyer is committed, wait a beat (so we never interrupt entry) then,
  // if the work isn't already Sold/Gifted, offer to update the status.
  function maybePromptStatus() {
    if (promptTimer.current) clearTimeout(promptTimer.current);
    promptTimer.current = setTimeout(() => {
      const cur = statusSelect()?.value ?? "";
      if (cur && cur !== "sold" && cur !== "gifted") {
        setChosen("sold");
        setPrompt({ current: cur });
      }
    }, 1500);
  }

  // Escape closes the status prompt (Apple + Impeccable both flagged the
  // missing dismiss affordances).
  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrompt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt]);

  function applyStatus() {
    const sel = statusSelect();
    if (sel) {
      sel.value = chosen;
      sel.dispatchEvent(new Event("change", { bubbles: true })); // triggers autosave
    }
    setPrompt(null);
  }

  const pick = (r: Result) => {
    setId(r.id);
    setName(r.name);
    setSearching(false);
    setQ("");
    setResults([]);
    maybePromptStatus();
  };

  const clear = () => {
    if (promptTimer.current) clearTimeout(promptTimer.current);
    setPrompt(null);
    setId("");
    setName("");
    setSearching(true);
    setQ("");
    setResults([]);
  };

  return (
    <div ref={rootRef}>
      <input ref={hiddenRef} type="hidden" name="buyer_contact_id" value={id} />

      {id && !searching ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-control px-2.5 py-0.5 text-[12px] text-ink-body">
            {name || "Selected contact"}
            <button type="button" onClick={clear} aria-label="Clear buyer" className="text-ink-muted hover:text-oranje">
              ×
            </button>
          </span>
          <button type="button" onClick={() => setSearching(true)} className="text-[12px] text-oranje">
            change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search CRM contacts…"
            className={input}
          />
          {loading ? (
            <p className="mt-1 text-[12px] text-ink-muted">Searching…</p>
          ) : results.length > 0 ? (
            <ul className="mt-1 divide-y divide-line-control overflow-hidden rounded-lg border border-line-control">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-[13.5px] text-ink-body hover:bg-control"
                  >
                    <span>{r.name}</span>
                    {r.email ? <span className="text-[12px] text-ink-muted">{r.email}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="mt-1 text-[12px] text-ink-muted">No matches.</p>
          ) : null}
          {id ? (
            <button type="button" onClick={() => setSearching(false)} className="mt-1 text-[12px] text-ink-muted hover:text-oranje">
              cancel
            </button>
          ) : null}
        </div>
      )}

      {prompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--jvb-bg-overlay)", backdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrompt(null);
          }}
        >
          <div className="w-full max-w-sm rounded-[13px] border border-line bg-cell p-5 shadow-xl">
            <h2 className="text-[15px] font-semibold text-ink-strong">Update the status?</h2>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              This work has a buyer but its status is “{label(prompt.current)}”. Would you like to
              change it?
            </p>
            <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              New status
              <select
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] capitalize text-ink-body"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrompt(null)}
                className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-medium text-ink-mid"
              >
                Leave unchanged
              </button>
              <button
                type="button"
                onClick={applyStatus}
                className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
              >
                Update status
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABELS } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";

type Result = { id: string; name: string; email: string | null };

// Mirrors the status options in piece-form.tsx.
const STATUSES = Object.keys(STATUS_LABELS);
const label = (s: string) => STATUS_LABELS[s] ?? s.replace(/_/g, " ");

export function BuyerSelect({
  id: inputId,
  initialId,
  initialName,
}: {
  /** For the search box, so the form's "Buyer" label names it. */
  id?: string;
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
          <span className="inline-flex min-h-[var(--jvb-control-h-sm)] items-center gap-1 border border-rule-strong pl-2.5 text-[13px] text-ink">
            {name || "Selected contact"}
            <Button variant="quiet" size="sm" iconOnly label="Clear buyer" onClick={clear}>
              <CloseIcon size={14} />
            </Button>
          </span>
          <button type="button" onClick={() => setSearching(true)} className="link text-[12px]">
            Change
          </button>
        </div>
      ) : (
        <div>
          <input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search CRM contacts…"
            className="field"
          />
          {loading ? (
            <p className="mt-1 text-[12px] text-meta">Searching…</p>
          ) : results.length > 0 ? (
            <ul data-inset-focus className="mt-1 divide-y divide-rule overflow-hidden border border-rule-strong">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-[13px] text-ink hover:bg-band"
                  >
                    <span>{r.name}</span>
                    {r.email ? <span className="text-[12px] text-body">{r.email}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            <p className="mt-1 text-[12px] text-meta">No matches.</p>
          ) : null}
          {id ? (
            <Button variant="quiet" size="sm" onClick={() => setSearching(false)} className="mt-1 -ml-1.5">
              Cancel
            </Button>
          ) : null}
        </div>
      )}

      {prompt ? (
        <div
          className="jvb-scrim-enter fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--jvb-scrim)" }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrompt(null);
          }}
        >
          <div
            className="jvb-pop-enter w-full max-w-sm border border-rule-strong bg-page p-5"
            style={{ boxShadow: "var(--jvb-shadow-pop)" }}
          >
            <h2 className="text-[14.5px] font-semibold leading-[1.45] text-ink">Update the status?</h2>
            <p className="mt-1.5 text-[13px] leading-[1.45] text-body">
              This work has a buyer but its status is “{label(prompt.current)}”. Would you like to
              change it?
            </p>
            <div className="mt-4 flex flex-col gap-1">
              <label htmlFor="buyer-new-status" className="label">
                New status
              </label>
              <select
                id="buyer-new-status"
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                className="field"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button onClick={() => setPrompt(null)}>Leave unchanged</Button>
              <Button variant="primary" onClick={applyStatus}>
                Update status
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

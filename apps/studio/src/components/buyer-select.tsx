"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABELS } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { useContactSearch, type ContactHit } from "@/components/use-contact-search";
import { useModalFocus } from "@/components/use-modal-focus";

type Result = ContactHit;

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
  // Debounced search against the CRM contacts endpoint, only while searching.
  // A failed search says so (`searchError`) instead of "No matches.".
  const { results, setResults, loading, error: searchError } = useContactSearch(q, searching);

  // Status-change prompt shown after a buyer is picked on a not-yet-sold work.
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const [prompt, setPrompt] = useState<{ current: string } | null>(null);
  const [chosen, setChosen] = useState("sold");

  // A hidden input's React value change does not emit a DOM event, so nudge the
  // autosave form whenever the buyer changes (also covers the pick below).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id]);

  useEffect(
    () => () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    },
    [],
  );

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

  // The prompt is a modal layer: focus moves to its status select (the
  // result that was clicked no longer exists), Tab stays inside, Escape
  // closes it, and focus goes back to the buyer's "Change" button (or the
  // search box) after.
  useModalFocus(Boolean(prompt), dialogRef, {
    initial: () => statusRef.current,
    returnTo: () => changeRef.current ?? searchRef.current,
    onEscape: () => setPrompt(null),
  });

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
          <span className="inline-flex min-h-[var(--jvb-control-h-sm)] items-center gap-1 border border-[var(--jvb-field-frame)] bg-[var(--jvb-field-bg)] pl-2.5 text-[13px] text-ink">
            {name || "Selected contact"}
            <Button variant="quiet" size="sm" iconOnly label="Clear buyer" onClick={clear}>
              <CloseIcon size={14} />
            </Button>
          </span>
          <button ref={changeRef} type="button" onClick={() => setSearching(true)} className="link text-[12px]">
            Change
          </button>
        </div>
      ) : (
        <div>
          <input
            ref={searchRef}
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
            <ul data-inset-focus className="jvb-slide-enter mt-1 divide-y divide-rule overflow-hidden border border-rule-strong">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="menu-row flex w-full flex-col items-start px-3 py-2 text-left text-[13px] text-ink"
                  >
                    <span>{r.name}</span>
                    {r.email ? <span className="text-[12px] text-body">{r.email}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : q.trim().length >= 2 ? (
            // A failed search says so: "No matches." would read as "not in the
            // CRM" and lead to a duplicate contact.
            <p role={searchError ? "alert" : undefined} className={`mt-1 text-[12px] ${searchError ? "text-danger" : "text-meta"}`}>
              {searchError ?? "No matches."}
            </p>
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrompt(null);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="buyer-status-title"
            aria-describedby="buyer-status-text"
            className="jvb-pop-enter w-full max-w-sm border border-rule-strong bg-page p-5"
            style={{ boxShadow: "var(--jvb-shadow-pop)" }}
          >
            <h2 id="buyer-status-title" className="text-[14.5px] font-semibold leading-[1.45] text-ink">
              Update the status?
            </h2>
            <p id="buyer-status-text" className="mt-1.5 text-[13px] leading-[1.45] text-body">
              This work has a buyer but its status is “{label(prompt.current)}”. Would you like to
              change it?
            </p>
            <div className="mt-4 flex flex-col gap-1">
              <label htmlFor="buyer-new-status" className="label">
                New status
              </label>
              {/* No name: this select must not join the autosave form's posted keys. */}
              <select
                ref={statusRef}
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

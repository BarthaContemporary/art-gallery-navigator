"use client";

import { useState } from "react";

type Suggestions = {
  hashtags: string[];
  object_type: string;
  materials: string[];
  techniques: string[];
  motifs: string[];
  suggested_category: string;
  suggested_medium: string;
  suggested_period: string;
  description_draft: string;
};

/**
 * On-demand AI cataloguing assistant. Analyses the object's primary image and
 * proposes hashtags + draft field values — review-and-accept only. Accepted
 * hashtags are appended to the piece's tags; field drafts are shown for the
 * cataloguer to copy into the form. Degrades to a notice when no key is set.
 */
export function AiCataloguer({ stockNumber }: { stockNumber: string }) {
  const [state, setState] = useState<
    "idle" | "loading" | "done" | "unconfigured" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagState, setTagState] = useState<"idle" | "saving" | "saved">("idle");

  async function analyse() {
    setState("loading");
    setMessage(null);
    setSuggestions(null);
    setTagState("idle");
    try {
      const res = await fetch("/api/ai/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stock: stockNumber }),
      });
      const data = await res.json();
      if (data.configured === false) {
        setState("unconfigured");
        return;
      }
      if (!res.ok || data.error) {
        setState("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      if (!data.suggestions) {
        setState("done");
        setMessage(data.message ?? "No suggestions.");
        return;
      }
      const s = data.suggestions as Suggestions;
      setSuggestions(s);
      setSelected(new Set(s.hashtags ?? []));
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error.");
    }
  }

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function acceptTags() {
    if (selected.size === 0) return;
    setTagState("saving");
    try {
      const res = await fetch("/api/ai/accept-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stock: stockNumber, tags: [...selected] }),
      });
      if (!res.ok) throw new Error();
      setTagState("saved");
    } catch {
      setTagState("idle");
      setMessage("Could not save tags.");
      setState("error");
    }
  }

  const field = (label: string, value: string) =>
    value ? (
      <div className="mt-3">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          {label}
        </p>
        <p className="mt-0.5 font-serif text-[13.5px] text-ink-body">{value}</p>
      </div>
    ) : null;

  return (
    <section className="mt-6 rounded-[11px] border border-line bg-band p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink-strong">
            AI cataloguing assistant
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Proposes hashtags and draft fields from the primary image. Review and
            accept — nothing is applied automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={analyse}
          disabled={state === "loading"}
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid disabled:opacity-50"
        >
          {state === "loading" ? "Analysing…" : "Analyse image"}
        </button>
      </div>

      {state === "unconfigured" ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          AI analysis isn’t configured. Set <code>ANTHROPIC_API_KEY</code> in the
          studio environment to enable it.
        </p>
      ) : null}

      {message && state !== "unconfigured" ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">{message}</p>
      ) : null}

      {suggestions ? (
        <div className="mt-4">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Hashtags — tap to include
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.hashtags.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] ${
                    on
                      ? "border-ink-strong bg-tag-dark text-primary-fg"
                      : "border-line-control bg-control text-ink-mid"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={acceptTags}
              disabled={selected.size === 0 || tagState === "saving"}
              className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg disabled:opacity-50"
            >
              {tagState === "saving"
                ? "Saving…"
                : `Add ${selected.size} tag${selected.size === 1 ? "" : "s"} to record`}
            </button>
            {tagState === "saved" ? (
              <span className="text-[12px] text-status-green">Tags saved.</span>
            ) : null}
          </div>

          {field("Suggested category", suggestions.suggested_category)}
          {field("Suggested medium", suggestions.suggested_medium)}
          {field("Suggested period", suggestions.suggested_period)}
          {field(
            "Materials / techniques / motifs",
            [
              ...suggestions.materials,
              ...suggestions.techniques,
              ...suggestions.motifs,
            ].join(" · "),
          )}
          {field("Draft description", suggestions.description_draft)}
          <p className="mt-3 text-[11px] text-ink-soft">
            Field drafts are suggestions — copy anything useful into the form
            above. Tags are the only thing the button writes.
          </p>
        </div>
      ) : null}
    </section>
  );
}

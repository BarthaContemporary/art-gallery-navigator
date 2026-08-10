"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RegisterBadge } from "@/components/register-badge";
import { titleWithYear as formatTitleWithYear } from "@jvb/db";

type Suggestions = {
  hashtags: string[];
  suggested_category: string;
  suggested_medium: string;
  suggested_period: string;
  materials: string[];
  techniques: string[];
  motifs: string[];
  description_draft: string;
};

export function EditHeader({
  thumbUrl,
  stockNumber,
  title,
  year,
  legacyStock,
  legacyConflict,
  imageCount,
  webVisible,
  ledger,
}: {
  thumbUrl: string | null;
  stockNumber: string;
  title: string | null;
  year?: number | string | null;
  legacyStock: string | null;
  legacyConflict: boolean;
  imageCount: number;
  webVisible: boolean;
  ledger?: "jvb" | "external";
}) {
  const titleWithYear = formatTitleWithYear(title, year);
  const imagesHref = `/inventory/${encodeURIComponent(stockNumber)}/images`;

  // --- website visibility toggle (submits web_visible with the form) ---
  const [visible, setVisible] = useState(webVisible);
  const webInputRef = useRef<HTMLInputElement>(null);
  function toggleVisible() {
    setVisible((v) => !v);
    // Nudge the autosave form (a controlled value change alone doesn't bubble).
    queueMicrotask(() =>
      webInputRef.current?.dispatchEvent(new Event("input", { bubbles: true })),
    );
  }

  // --- AI analysis ---
  const [state, setState] = useState<"idle" | "loading" | "done" | "unconfigured" | "error">("idle");
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
      if (data.configured === false) return setState("unconfigured");
      if (!res.ok || data.error) {
        setMessage(data.error ?? "Something went wrong.");
        return setState("error");
      }
      if (!data.suggestions) {
        setMessage(data.message ?? "No suggestions.");
        return setState("done");
      }
      const s = data.suggestions as Suggestions;
      setSuggestions(s);
      setSelected(new Set(s.hashtags ?? []));
      setState("done");
    } catch {
      setMessage("Network error.");
      setState("error");
    }
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

  const btn =
    "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid disabled:opacity-50";
  const draft = (l: string, val: string) =>
    val ? (
      <div className="mt-3">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">{l}</p>
        <p className="mt-0.5 font-serif text-[13.5px] text-ink-body">{val}</p>
      </div>
    ) : null;

  return (
    <div>
      <input ref={webInputRef} type="hidden" name="web_visible" value={visible ? "on" : ""} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* preview image (→ image management) + title + record number */}
        <div className="flex items-center gap-4">
          <Link href={imagesHref} className="block shrink-0" title="Manage images">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt={title ?? "Object"} className="h-24 w-24 rounded-lg object-cover" />
            ) : (
              <span className="jvb-hatch flex h-24 w-24 items-center justify-center rounded-lg text-[20px] text-ink-soft">
                ▦
              </span>
            )}
          </Link>
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-ink-strong">
              {titleWithYear}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[13px] text-ink-muted">
              {stockNumber}
              <RegisterBadge ledger={ledger} size="xs" />
              {legacyStock ? (
                <span className="text-ink-soft">
                  · Legacy {legacyStock}
                  {legacyConflict ? " (dup)" : ""}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={imagesHref} className={btn}>
            Manage images ({imageCount})
          </Link>
          <button type="button" onClick={analyse} disabled={state === "loading"} className={btn}>
            {state === "loading" ? "Analysing…" : "Analyse image"}
          </button>
          <button
            type="button"
            onClick={toggleVisible}
            className={`inline-flex items-center gap-2 ${btn}`}
            title={visible ? "Visible on website" : "Not on the website"}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: visible ? "var(--jvb-status-green)" : "var(--jvb-danger)" }}
            />
            On website
          </button>
        </div>
      </div>

      {/* AI results */}
      {state === "unconfigured" ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          AI analysis isn’t configured. Set <code>ANTHROPIC_API_KEY</code> in the studio environment.
        </p>
      ) : null}
      {message && state !== "unconfigured" ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">{message}</p>
      ) : null}
      {suggestions ? (
        <section className="mt-4 rounded-[11px] border border-line bg-band p-5">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            AI hashtags — tap to include
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.hashtags.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelected((p) => {
                      const n = new Set(p);
                      if (n.has(tag)) n.delete(tag);
                      else n.add(tag);
                      return n;
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] ${
                    on ? "border-ink-strong bg-tag-dark text-primary-fg" : "border-line-control bg-control text-ink-mid"
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
              {tagState === "saving" ? "Saving…" : `Add ${selected.size} tag${selected.size === 1 ? "" : "s"} to record`}
            </button>
            {tagState === "saved" ? <span className="text-[12px] text-status-green">Tags saved.</span> : null}
          </div>
          {draft("Suggested category", suggestions.suggested_category)}
          {draft("Suggested medium", suggestions.suggested_medium)}
          {draft("Suggested period", suggestions.suggested_period)}
          {draft("Materials / techniques / motifs", [...suggestions.materials, ...suggestions.techniques, ...suggestions.motifs].join(" · "))}
          {draft("Draft description", suggestions.description_draft)}
          <p className="mt-3 text-[11px] text-ink-soft">
            Field drafts are suggestions — copy anything useful into the form. Only tags are written.
          </p>
        </section>
      ) : null}
    </div>
  );
}

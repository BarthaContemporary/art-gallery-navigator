"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { RegisterBadge } from "@/components/register-badge";
import { titleWithYear as formatTitleWithYear } from "@jvb/db";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chips";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/section";
import { WebsiteSwitch } from "@/components/ui/website-switch";
import { ImageIcon } from "@/components/ui/icons";

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

/*
 * The editor's title block sits above the sticky save line, outside the
 * autosaving <form>, but two of its controls post with the form: the website
 * switch (web_visible) and "Mark catalogued" (needs_completion). Their state
 * lives in EditHeaderProvider; EditHeader draws the controls and
 * EditHeaderFields, inside the form, holds the hidden inputs and tells the
 * form when they change.
 */
type HeaderState = {
  visible: boolean;
  toggleVisible: () => void;
  needsCompletion: boolean;
  needsFinish: boolean;
  finishTouched: boolean;
  toggleFinish: () => void;
  webInputRef: RefObject<HTMLInputElement | null>;
  finishInputRef: RefObject<HTMLInputElement | null>;
};
const HeaderContext = createContext<HeaderState | null>(null);

function useHeader(): HeaderState {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error("EditHeader needs an EditHeaderProvider");
  return ctx;
}

export function EditHeaderProvider({
  webVisible,
  needsCompletion = false,
  children,
}: {
  webVisible: boolean;
  /** Captured on mobile and not yet catalogued (pieces.needs_completion). */
  needsCompletion?: boolean;
  children: ReactNode;
}) {
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

  // --- "Needs completion" (set by the capture app; nothing else cleared it) ---
  // The routes touch the column only when the key is posted, and the hidden
  // field appears only once the button has been pressed here. So ordinary
  // saves never write it: a record marked catalogued in another tab, or
  // re-flagged by the capture app, is not reset by an editor left open.
  // Undo stays available until the page is left.
  const [needsFinish, setNeedsFinish] = useState(needsCompletion);
  const [finishTouched, setFinishTouched] = useState(false);
  const finishInputRef = useRef<HTMLInputElement>(null);
  function toggleFinish() {
    setFinishTouched(true);
    setNeedsFinish((v) => !v);
  }

  return (
    <HeaderContext.Provider
      value={{
        visible,
        toggleVisible,
        needsCompletion,
        needsFinish,
        finishTouched,
        toggleFinish,
        webInputRef,
        finishInputRef,
      }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

/** The header's posted fields; render inside the autosave form. */
export function EditHeaderFields() {
  const { visible, needsCompletion, needsFinish, finishTouched, webInputRef, finishInputRef } = useHeader();
  // After the commit, so the field exists (and holds the new value) when the
  // autosave form hears about it.
  useEffect(() => {
    if (finishTouched) {
      finishInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [needsFinish, finishTouched, finishInputRef]);
  return (
    <>
      <input ref={webInputRef} type="hidden" name="web_visible" value={visible ? "on" : ""} />
      {needsCompletion && finishTouched ? (
        <input
          ref={finishInputRef}
          type="hidden"
          name="needs_completion"
          value={needsFinish ? "on" : ""}
        />
      ) : null}
    </>
  );
}

/** Field names the AI drafts can fill, as posted by the piece form. */
type DraftField = "category" | "medium" | "period" | "description";

export function EditHeader({
  thumbUrl,
  stockNumber,
  title,
  year,
  legacyStock,
  legacyConflict,
  imageCount,
  ledger,
}: {
  thumbUrl: string | null;
  stockNumber: string;
  title: string | null;
  year?: number | string | null;
  legacyStock: string | null;
  legacyConflict: boolean;
  imageCount: number;
  ledger?: "jvb" | "external";
}) {
  const { visible, toggleVisible, needsCompletion, needsFinish, toggleFinish, webInputRef } = useHeader();
  const titleWithYear = formatTitleWithYear(title, year);
  const imagesHref = `/inventory/${encodeURIComponent(stockNumber)}/images`;

  // --- AI analysis ---
  const [state, setState] = useState<"idle" | "loading" | "done" | "unconfigured" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagState, setTagState] = useState<"idle" | "saving" | "saved">("idle");
  const [used, setUsed] = useState<Set<DraftField>>(new Set());

  async function analyse() {
    setState("loading");
    setMessage(null);
    setSuggestions(null);
    setTagState("idle");
    setUsed(new Set());
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

  // The form this header posts with, found through its own hidden field.
  const form = () => webInputRef.current?.form ?? null;

  /** The category option a suggestion names, matched on its words. */
  function categoryOption(name: string): HTMLOptionElement | null {
    const select = form()?.elements.namedItem("category_id");
    if (!(select instanceof HTMLSelectElement)) return null;
    const want = name.trim().toLowerCase();
    if (!want) return null;
    return (
      [...select.options].find((o) => o.value && o.text.trim().toLowerCase() === want) ??
      [...select.options].find((o) => o.value && o.text.toLowerCase().includes(want)) ??
      null
    );
  }

  /**
   * Put a draft into its field, then fire the event the autosave form listens
   * for (the pattern of the website switch above), so it saves like typing.
   * The category select is controlled by its component, which follows the
   * change event.
   */
  function applyDraft(field: DraftField, value: string) {
    const f = form();
    if (!f) return;
    if (field === "category") {
      const option = categoryOption(value);
      const select = f.elements.namedItem("category_id");
      if (!option || !(select instanceof HTMLSelectElement)) return;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const el = f.elements.namedItem(field);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setUsed((u) => new Set(u).add(field));
  }

  const draft = (label: string, value: string, field?: DraftField) => {
    if (!value) return null;
    const usable = field && (field !== "category" || categoryOption(value) !== null);
    return (
      <div className="flex items-start gap-3 border-t border-rule py-2.5">
        <div className="min-w-0 flex-1">
          <p className="label">{label}</p>
          <p className="mt-0.5 font-serif text-[13.5px] leading-[1.5] text-body">{value}</p>
          {field === "category" && !usable ? (
            <p className="mt-0.5 text-[12px] text-meta">No category of that name yet.</p>
          ) : null}
        </div>
        {field && usable ? (
          <Button
            size="sm"
            onClick={() => applyDraft(field, value)}
            aria-label={`Use the suggested ${label.replace(/^Suggested /, "").toLowerCase()}`}
            title={field === "description" ? "Replaces the description with this draft" : undefined}
          >
            {used.has(field) ? "Used" : "Use"}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* preview image (→ image management) + title + record number */}
        <div className="flex min-w-0 items-center gap-4">
          <Link href={imagesHref} className="block shrink-0" title="Manage images">
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt={title ?? "Object"} className="h-20 w-20 bg-band object-cover" />
            ) : (
              <span className="jvb-hatch flex h-20 w-20 items-center justify-center text-meta">
                <ImageIcon size={20} />
              </span>
            )}
          </Link>
          <div className="min-w-0">
            <h1 className="text-title text-ink">{titleWithYear}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] leading-[1.4] text-meta">
              <span className="tabular">{stockNumber}</span>
              <RegisterBadge ledger={ledger} size="xs" />
              {legacyStock ? (
                <span>
                  Legacy <span className="tabular">{legacyStock}</span>
                  {legacyConflict ? " (duplicate)" : ""}
                </span>
              ) : null}
              {needsCompletion ? (
                <span className="inline-flex items-center gap-2">
                  {needsFinish ? (
                    <Badge tone="warn" size="xs" title="Captured on mobile and not yet catalogued">
                      Needs completion
                    </Badge>
                  ) : (
                    <Badge tone="ok" size="xs">
                      Catalogued
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={toggleFinish}
                    className="link text-[12px]"
                    title={
                      needsFinish
                        ? "Clears the Finish badge in the inventory and the dashboard count"
                        : "Put the Finish badge back"
                    }
                  >
                    {needsFinish ? "Mark catalogued" : "Undo"}
                  </button>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={imagesHref} size="sm" icon={<ImageIcon size={14} />}>
            Manage images <span className="tabular text-meta">{imageCount}</span>
          </ButtonLink>
          <Button size="sm" onClick={analyse} pending={state === "loading"} pendingLabel="Analysing…">
            Analyse image
          </Button>
          {/* The website switch: the only thing that puts a work on the site. */}
          <WebsiteSwitch
            on={visible}
            onClick={toggleVisible}
            title={visible ? "Shown on the website. Press to take it off." : "Not on the website. Press to publish it."}
          />
        </div>
      </div>

      {/* AI results */}
      {state === "unconfigured" ? (
        <Notice className="mt-4">
          AI analysis isn’t configured. Set <code>ANTHROPIC_API_KEY</code> in the studio environment.
        </Notice>
      ) : null}
      {message && state !== "unconfigured" ? (
        <Notice tone={state === "error" ? "danger" : "info"} className="mt-4">
          {message}
        </Notice>
      ) : null}
      {suggestions ? (
        <Panel title="AI suggestions" className="mt-4">
          <p className="label">Hashtags: press to include or leave out</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.hashtags.map((tag) => (
              <ToggleChip
                key={tag}
                pressed={selected.has(tag)}
                onClick={() =>
                  setSelected((p) => {
                    const n = new Set(p);
                    if (n.has(tag)) n.delete(tag);
                    else n.add(tag);
                    return n;
                  })
                }
              >
                {tag}
              </ToggleChip>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={acceptTags}
              disabled={selected.size === 0}
              pending={tagState === "saving"}
              pendingLabel="Saving…"
            >
              {`Add ${selected.size} tag${selected.size === 1 ? "" : "s"} to record`}
            </Button>
            {tagState === "saved" ? <span className="text-[12px] text-ok">Tags saved.</span> : null}
          </div>
          <div className="mt-4">
            {draft("Suggested category", suggestions.suggested_category, "category")}
            {draft("Suggested medium", suggestions.suggested_medium, "medium")}
            {draft("Suggested period", suggestions.suggested_period, "period")}
            {draft(
              "Materials, techniques and motifs",
              [...suggestions.materials, ...suggestions.techniques, ...suggestions.motifs].join(" · "),
            )}
            {draft("Draft description", suggestions.description_draft, "description")}
          </div>
          <p className="mt-2 text-[12px] leading-[1.4] text-meta">
            The drafts are suggestions. Use puts one into its field, where it saves like any edit;
            only the tags are written straight to the record.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

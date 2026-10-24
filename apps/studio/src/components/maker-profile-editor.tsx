"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { nativeFieldLang } from "@/lib/script-lang";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chips";
import { Notice } from "@/components/ui/notice";
import { SaveStatus } from "@/components/ui/save-status";
import { WebsiteSwitch } from "@/components/ui/website-switch";
import {
  BoldIcon,
  HeadingIcon,
  ItalicIcon,
  ListIcon,
  NumberedListIcon,
  ParagraphIcon,
  SubheadingIcon,
  UnderlineIcon,
  UploadIcon,
  type IconProps,
} from "@/components/ui/icons";

export type MakerFields = {
  display_name: string;
  native_name: string;
  romanized_name: string;
  life_dates: string;
  region: string;
  school_or_workshop: string;
};

const FIELD_LABELS: [keyof MakerFields, string, string][] = [
  ["display_name", "Name (romanized)", "Kobayashi Shōmin"],
  ["native_name", "Native name", "小林紹民"],
  ["romanized_name", "Romanized variant", ""],
  ["life_dates", "Life dates", "1912–1994"],
  ["region", "Region", "Japan"],
  ["school_or_workshop", "School / workshop", ""],
];

/**
 * The profile toolbar: Tabler's formatting icons (no glyphs standing in for
 * them), each button named by aria-label and tooltip, and reporting through
 * aria-pressed whether the text at the caret already has it.
 */
type Tool = { key: string; Icon: ComponentType<IconProps>; label: string; run: [string, string?] };
const TOOLS: Tool[] = [
  { key: "bold", Icon: BoldIcon, label: "Bold", run: ["bold"] },
  { key: "italic", Icon: ItalicIcon, label: "Italic", run: ["italic"] },
  { key: "underline", Icon: UnderlineIcon, label: "Underline", run: ["underline"] },
  { key: "h2", Icon: HeadingIcon, label: "Heading", run: ["formatBlock", "<h2>"] },
  { key: "h3", Icon: SubheadingIcon, label: "Subheading", run: ["formatBlock", "<h3>"] },
  { key: "p", Icon: ParagraphIcon, label: "Paragraph", run: ["formatBlock", "<p>"] },
  { key: "ul", Icon: ListIcon, label: "Bulleted list", run: ["insertUnorderedList"] },
  { key: "ol", Icon: NumberedListIcon, label: "Numbered list", run: ["insertOrderedList"] },
];

/** Which tools apply at the caret, read from the browser's editing state. */
function toolStates(): Record<string, boolean> {
  const q = (c: string) => {
    try {
      return document.queryCommandState(c);
    } catch {
      return false;
    }
  };
  let block = "";
  try {
    block = String(document.queryCommandValue("formatBlock") ?? "").toLowerCase();
  } catch {
    /* unsupported: leave the block tools unpressed */
  }
  return {
    bold: q("bold"),
    italic: q("italic"),
    underline: q("underline"),
    h2: block === "h2",
    h3: block === "h3",
    p: block === "p",
    ul: q("insertUnorderedList"),
    ol: q("insertOrderedList"),
  };
}

/**
 * The single maker editing panel: detail fields + representative portrait +
 * rich-text profile, all autosaving. The portrait upload processes the image
 * server-side (original kept for exports, sRGB display master for studio and
 * web) with an upload/processing progress bar; when empty, the image field is
 * a drag-and-drop area. The image column and the rich-text field sit on a
 * shared grid row so their tops align.
 */
export function MakerProfileEditor({
  makerId,
  initialHtml,
  portraitUrl,
  initialFields,
  initialWebVisible = false,
}: {
  makerId: string;
  /**
   * The stored profile, already run through sanitizeHtml() by the page: the
   * editor puts it in with innerHTML, and the database column may hold
   * whatever an older version of the studio let through.
   */
  initialHtml: string;
  portraitUrl: string | null;
  initialFields: MakerFields;
  /** Publish an artist page even with no work currently on the site. */
  initialWebVisible?: boolean;
}) {
  const [fields, setFields] = useState<MakerFields>(initialFields);
  const [webVisible, setWebVisible] = useState(initialWebVisible);

  async function toggleWebVisible(next: boolean) {
    setWebVisible(next);
    setStatus("saving");
    try {
      const res = await fetch(`/api/makers/${makerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webVisible: next }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }
  const fieldsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MakerFields>(initialFields);
  const [url, setUrl] = useState(portraitUrl);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<{ url: string; title: string }[]>([]);
  // An AI draft waiting for a person to read it. It is not in the editor and
  // not saved: only "Keep this draft" puts it into the profile.
  const [aiDraft, setAiDraft] = useState<{ html: string; sources: { url: string; title: string }[] } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  // contentEditable is uncontrolled — seed it once.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the toolbar's pressed states in step with the caret, while it is in
  // the profile text.
  useEffect(() => {
    const onSelection = () => {
      const sel = document.getSelection();
      if (editorRef.current && sel?.anchorNode && editorRef.current.contains(sel.anchorNode)) setPressed(toolStates());
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  // Profile saves go out one after another, so they land in the order they
  // were made: pressing "Keep this draft" blurs the editor, and that blur's
  // save of the old text must not overtake the draft's.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  function save() {
    const run = async () => {
      if (!editorRef.current) return;
      setStatus("saving");
      try {
        const res = await fetch(`/api/makers/${makerId}/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: editorRef.current.innerHTML }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    };
    saveQueue.current = saveQueue.current.then(run);
    return saveQueue.current;
  }
  function scheduleSave() {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  }

  async function saveFields(next: MakerFields) {
    setStatus("saving");
    try {
      const res = await fetch(`/api/makers/${makerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: next }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }
  function setField(key: keyof MakerFields, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    pending.current = next;
    setStatus("saving");
    if (fieldsTimer.current) clearTimeout(fieldsTimer.current);
    fieldsTimer.current = setTimeout(() => void saveFields(next), 800);
  }

  // Leaving a detail field commits it straight away. Without this, typing a
  // name and immediately clicking away — or back to the maker list — dropped
  // the edit with the debounce still pending.
  function flushFields() {
    if (!fieldsTimer.current) return;
    clearTimeout(fieldsTimer.current);
    fieldsTimer.current = null;
    void saveFields(pending.current);
  }

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setPressed(toolStates());
    scheduleSave();
  }

  /**
   * Ask for an AI research draft and show it for review. The model reads
   * web pages anyone can write, so the draft is never saved on arrival: it
   * waits below the profile, with its sources, until someone keeps or
   * discards it.
   */
  async function draftWithAi() {
    if (aiBusy) return;
    const existing = editorRef.current?.textContent?.trim() ?? "";
    if (
      existing &&
      !window.confirm(
        "Write a fresh AI research draft of this profile? It is shown below for you to read first. Nothing is saved or published to the website unless you choose “Keep this draft”, which then replaces the current text.",
      )
    )
      return;
    setAiBusy(true);
    setAiError(null);
    setAiSources([]);
    setAiDraft(null);
    try {
      const res = await fetch(`/api/makers/${makerId}/ai-draft`, { method: "POST" });
      const json = (await res.json()) as {
        html?: string;
        sources?: { url: string; title: string }[];
        error?: string;
      };
      if (!res.ok || !json.html) throw new Error(json.error ?? "Draft failed");
      setAiDraft({ html: json.html, sources: json.sources ?? [] });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setAiBusy(false);
    }
  }

  /** The reviewed draft becomes the profile, and is saved (and so published). */
  function keepDraft() {
    if (!aiDraft || !editorRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    editorRef.current.innerHTML = aiDraft.html;
    // The sources stay in view under the profile, for checking while editing.
    setAiSources(aiDraft.sources);
    setAiDraft(null);
    void save();
  }

  /**
   * Three legs: get a signed storage URL, PUT the original straight to
   * storage (XHR for real progress — and Vercel routes cap bodies at 4.5MB,
   * so the file must not travel through an API route), then ask the server
   * to generate the display master.
   */
  async function uploadPortrait(file: File) {
    setUploadError(null);
    setPhase("uploading");
    setProgress(0);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const signRes = await fetch(`/api/makers/${makerId}/portrait/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext }),
      });
      const sign = (await signRes.json()) as { path?: string; signedUrl?: string; error?: string };
      if (!signRes.ok || !sign.signedUrl || !sign.path)
        throw new Error(sign.error ?? "Could not start the upload");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sign.signedUrl!);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(e.loaded / e.total);
        };
        xhr.onload = () =>
          xhr.status < 400 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      setPhase("processing");
      const procRes = await fetch(`/api/makers/${makerId}/portrait/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sign.path }),
      });
      const text = await procRes.text();
      let json: { url?: string | null; error?: string };
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        throw new Error(`Processing failed (${procRes.status}): ${text.slice(0, 80)}`);
      }
      if (!procRes.ok || json.error) throw new Error(json.error ?? "Processing failed");
      setUrl(json.url ?? null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhase("idle");
    }
  }

  function onPick(list: FileList | null) {
    const file = list?.[0];
    if (file) void uploadPortrait(file);
  }

  async function removePortrait() {
    await fetch(`/api/makers/${makerId}/portrait`, { method: "DELETE" });
    setUrl(null);
  }

  const busy = phase !== "idle";

  return (
    <div className="space-y-6">
      {/* Retry sends the details and the profile again, as the next edit
          would. */}
      <SaveStatus
        state={status}
        what="the maker"
        idleText="Changes save automatically"
        onRetry={() => {
          void saveFields(pending.current);
          void save();
        }}
      />

      <Section title="Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_LABELS.map(([key, label, ph]) => (
            <div key={key} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`maker-${key}`} className="label">
                {label}
              </label>
              <input
                id={`maker-${key}`}
                value={fields[key]}
                placeholder={ph ? `e.g. ${ph}` : undefined}
                lang={key === "native_name" ? nativeFieldLang(fields[key]) : undefined}
                onChange={(e) => setField(key, e.target.value)}
                onBlur={flushFields}
                className="field"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <WebsiteSwitch
            on={webVisible}
            onLabel="Artist page on the website"
            offLabel="Artist page not on the website"
            onClick={() => void toggleWebVisible(!webVisible)}
          />
          <span className="text-[12px] leading-[1.4] text-meta">On for every maker; switch it off to hide this one.</span>
        </div>
      </Section>

      {/* Image + profile: two columns from md, headings level and the image
          field starting level with the rich-text field. */}
      <section className="section">
        {/* DOM order is reading order at every width: on a phone the image
            comes first, then the profile with its toolbar. */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-[230px_1fr]">
          {/* col 1: the heading, then the image field (a drop area when
              empty). The two heading rows share a minimum height, so the
              image starts level with the text beside it. */}
          <div>
            <div className="mb-2 flex min-h-[var(--jvb-control-h-sm)] items-end">
              <h2 className="section-title">Representative image</h2>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                void onPick(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label={url ? "Replace the portrait" : "Upload a portrait"}
              onClick={() => !busy && fileRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !busy) fileRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!busy) onPick(e.dataTransfer.files);
              }}
              className={`aspect-[3/4] w-full cursor-pointer overflow-hidden border transition-colors ${
                url
                  ? "border-rule bg-band"
                  : `border-dashed ${dragOver ? "border-accent bg-accent-wash" : "border-rule-strong bg-page hover:border-ink"}`
              }`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="Portrait" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <UploadIcon size={20} className="text-body" />
                  <p className="text-[13px] font-medium text-ink">
                    {dragOver ? "Drop to upload" : "Drop an image here"}
                  </p>
                  <p className="text-[12px] text-meta">or click to choose a file</p>
                </div>
              )}
            </div>

            {busy ? (
              <div className="mt-2">
                <div
                  role="progressbar"
                  aria-label="Portrait upload"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={phase === "uploading" ? Math.round(progress * 100) : undefined}
                  className="h-1 w-full overflow-hidden bg-rule"
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-200"
                    style={{ width: phase === "uploading" ? `${Math.round(progress * 90)}%` : "100%" }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-meta">
                  {phase === "uploading" ? `Uploading… ${Math.round(progress * 100)}%` : "Processing image…"}
                </p>
              </div>
            ) : null}
            {uploadError ? (
              <Notice tone="danger" inline className="mt-1.5">
                {uploadError}
              </Notice>
            ) : null}

            {url && !busy ? (
              <div className="mt-2 flex items-center gap-1">
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  Replace
                </Button>
                <Button size="sm" variant="quiet" onClick={() => void removePortrait()}>
                  Remove
                </Button>
              </div>
            ) : null}
            <p className="mt-1.5 text-[12px] leading-[1.4] text-meta">
              Ideally a portrait of the maker. The original is kept for print-quality
              documents; a web version is generated automatically.
            </p>
          </div>

          {/* col 2: the heading with its toolbar, then the rich-text profile */}
          <div>
            <div className="mb-2 flex min-h-[var(--jvb-control-h-sm)] flex-wrap items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <h2 className="section-title mr-2">Profile</h2>
                <div role="toolbar" aria-label="Profile formatting" className="flex flex-wrap gap-1">
                  {TOOLS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      aria-label={t.label}
                      aria-pressed={Boolean(pressed[t.key])}
                      title={t.label}
                      onClick={() => cmd(t.run[0], t.run[1])}
                      className={chipClass("w-[var(--jvb-control-h-sm)] justify-center px-0")}
                    >
                      <t.Icon size={15} />
                    </button>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                disabled={aiBusy}
                pending={aiBusy}
                pendingLabel="Researching… (can take a minute)"
                onClick={() => void draftWithAi()}
                title="Research this maker and write a draft biography with AI"
              >
                Draft with AI
              </Button>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Profile"
              onInput={scheduleSave}
              onBlur={() => {
                if (timer.current) clearTimeout(timer.current);
                void save();
              }}
              className="field-box prose-maker min-h-[280px] w-full px-4 py-3 text-[14.5px] leading-[1.6] text-ink [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            />
            <p className="mt-1.5 text-[12px] leading-[1.4] text-meta">
              Autosaves as you type. This text feeds the maker profile PDF and website page.
            </p>
            {aiDraft ? (
              <div role="region" aria-label="AI draft, not saved" className="panel mt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label">AI draft, not saved</p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="primary" onClick={keepDraft}>
                      Keep this draft
                    </Button>
                    <Button size="sm" variant="quiet" onClick={() => setAiDraft(null)}>
                      Discard
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-[12px] leading-[1.4] text-meta">
                  Read it and check its sources first. Nothing reaches the profile, the PDF or the website until you
                  keep it; keeping replaces the profile text above, where you can go on editing it.
                </p>
                {/* Sanitised by the draft route with the profile's own
                    allow-list, and set in the same type as the editor. */}
                <div
                  className="mt-3 text-[14.5px] leading-[1.6] text-ink [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: aiDraft.html }}
                />
                {aiDraft.sources.length > 0 ? (
                  <>
                    <p className="label mt-3">Sources the draft drew on</p>
                    <ul className="mt-1 space-y-0.5">
                      {aiDraft.sources.map((s) => (
                        <li key={s.url} className="truncate text-[12px]">
                          <a href={s.url} target="_blank" rel="noreferrer" className="link-plain text-body">
                            {s.title || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-3 text-[12px] leading-[1.4] text-meta">The draft cites no sources: verify it with care.</p>
                )}
              </div>
            ) : null}
            {aiError ? (
              <Notice tone="danger" inline className="mt-1.5">
                AI draft: {aiError}
              </Notice>
            ) : null}
            {aiSources.length > 0 ? (
              <div className="panel mt-2">
                <p className="label">Sources the kept draft drew on. Check the text against them</p>
                <ul className="mt-1 space-y-0.5">
                  {aiSources.map((s) => (
                    <li key={s.url} className="truncate text-[12px]">
                      <a href={s.url} target="_blank" rel="noreferrer" className="link-plain text-body">
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

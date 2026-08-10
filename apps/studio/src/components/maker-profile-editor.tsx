"use client";

import { useEffect, useRef, useState } from "react";

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

const HEADING = "text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

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
}: {
  makerId: string;
  initialHtml: string;
  portraitUrl: string | null;
  initialFields: MakerFields;
}) {
  const [fields, setFields] = useState<MakerFields>(initialFields);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // contentEditable is uncontrolled — seed it once.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
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
    scheduleSave();
  }

  async function draftWithAi() {
    if (aiBusy) return;
    const existing = editorRef.current?.textContent?.trim() ?? "";
    if (
      existing &&
      !window.confirm(
        "Replace the current profile text with a fresh AI research draft? The draft is fully editable afterwards.",
      )
    )
      return;
    setAiBusy(true);
    setAiError(null);
    setAiSources([]);
    try {
      const res = await fetch(`/api/makers/${makerId}/ai-draft`, { method: "POST" });
      const json = (await res.json()) as {
        html?: string;
        sources?: { url: string; title: string }[];
        error?: string;
      };
      if (!res.ok || !json.html) throw new Error(json.error ?? "Draft failed");
      if (editorRef.current) {
        editorRef.current.innerHTML = json.html;
        void save();
      }
      setAiSources(json.sources ?? []);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setAiBusy(false);
    }
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
  const tbtn =
    "rounded-md border border-line-control bg-control px-2 py-1 text-[12px] font-medium text-ink-mid hover:text-ink-strong";

  return (
    <div>
      {/* Details */}
      <div className="flex items-center justify-between">
        <p className={HEADING}>Details</p>
        <span className={`text-[11px] ${status === "error" ? "text-oranje" : "text-ink-soft"}`}>
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Couldn’t save" : "Autosave on"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELD_LABELS.map(([key, label, ph]) => (
          <label key={key} className="block text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            {label}
            <input
              value={fields[key]}
              placeholder={ph}
              onChange={(e) => setField(key, e.target.value)}
              onBlur={flushFields}
              className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body"
            />
          </label>
        ))}
      </div>

      {/* Image + profile: shared grid rows so headings align and the image
          field starts exactly level with the rich-text field. */}
      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-line-soft pt-5 md:grid-cols-[230px_1fr] md:grid-rows-[auto_1fr]">
        {/* row 1 — headings (toolbar lives in the same row so row 2 aligns) */}
        <p className={`${HEADING} self-end`}>Representative image</p>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`${HEADING} mr-2`}>Profile</p>
            <button type="button" onClick={() => cmd("bold")} className={`${tbtn} font-bold`}>B</button>
            <button type="button" onClick={() => cmd("italic")} className={`${tbtn} italic`}>I</button>
            <button type="button" onClick={() => cmd("underline")} className={`${tbtn} underline`}>U</button>
            <button type="button" onClick={() => cmd("formatBlock", "<h2>")} className={tbtn}>H2</button>
            <button type="button" onClick={() => cmd("formatBlock", "<h3>")} className={tbtn}>H3</button>
            <button type="button" onClick={() => cmd("formatBlock", "<p>")} className={tbtn}>¶</button>
            <button type="button" onClick={() => cmd("insertUnorderedList")} className={tbtn}>• List</button>
            <button type="button" onClick={() => cmd("insertOrderedList")} className={tbtn}>1. List</button>
          </div>
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void draftWithAi()}
            className="rounded-lg border border-oranje/40 bg-control px-3 py-1.5 text-[12px] font-medium text-oranje hover:border-oranje disabled:opacity-60"
            title="Research this maker and write a draft biography with AI"
          >
            {aiBusy ? "Researching… (can take a minute)" : "✦ Draft with AI"}
          </button>
        </div>

        {/* row 2, col 1 — image field (drop area when empty) */}
        <div>
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
            className={`aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-[11px] border transition-colors ${
              url
                ? "border-line bg-band"
                : `border-2 border-dashed ${dragOver ? "border-oranje bg-oranje/5" : "border-line-control bg-band/60"}`
            }`}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Portrait" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <span aria-hidden className="text-[22px] text-ink-soft">⬆︎</span>
                <p className="text-[12.5px] font-medium text-ink-mid">
                  {dragOver ? "Drop to upload" : "Drop an image here"}
                </p>
                <p className="text-[11px] text-ink-soft">or click to choose a file</p>
              </div>
            )}
          </div>

          {busy ? (
            <div className="mt-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-line-soft">
                <div
                  className={`h-full rounded-full bg-oranje transition-[width] duration-200 ${phase === "processing" ? "animate-pulse" : ""}`}
                  style={{ width: phase === "uploading" ? `${Math.round(progress * 90)}%` : "100%" }}
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                {phase === "uploading" ? `Uploading… ${Math.round(progress * 100)}%` : "Processing image…"}
              </p>
            </div>
          ) : null}
          {uploadError ? <p className="mt-1.5 text-[11.5px] text-oranje">{uploadError}</p> : null}

          {url && !busy ? (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid"
              >
                Replace
              </button>
              <button type="button" onClick={() => void removePortrait()} className="text-[12px] text-ink-soft hover:text-ink-strong">
                Remove
              </button>
            </div>
          ) : null}
          <p className="mt-1.5 text-[11px] text-ink-soft">
            Ideally a portrait of the maker. The original is kept for print-quality
            documents; a web version is generated automatically.
          </p>
        </div>

        {/* row 2, col 2 — rich text profile */}
        <div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={scheduleSave}
            onBlur={() => {
              if (timer.current) clearTimeout(timer.current);
              void save();
            }}
            className="prose-maker min-h-[280px] w-full rounded-[11px] border border-line-control bg-control px-4 py-3 text-[14px] leading-[1.6] text-ink-body focus:outline-none focus:ring-1 focus:ring-oranje/50 [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          />
          <p className="mt-1.5 text-[11px] text-ink-soft">
            Autosaves as you type. This text feeds the maker profile PDF and website page.
          </p>
          {aiError ? <p className="mt-1.5 text-[11.5px] text-oranje">AI draft: {aiError}</p> : null}
          {aiSources.length > 0 ? (
            <div className="mt-2 rounded-lg border border-line-soft bg-band/50 px-3 py-2">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Sources the draft drew on — verify before publishing
              </p>
              <ul className="mt-1 space-y-0.5">
                {aiSources.map((s) => (
                  <li key={s.url} className="truncate text-[11.5px]">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-oranje">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

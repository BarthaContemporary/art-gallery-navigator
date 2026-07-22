"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Maker profile editing: representative portrait upload + a small rich-text
 * editor (bold / italic / headings / lists) autosaving sanitised HTML to
 * /api/makers/[id]/profile. The HTML is the source for maker profile PDFs and
 * website pages.
 */
export function MakerProfileEditor({
  makerId,
  initialHtml,
  portraitUrl,
}: {
  makerId: string;
  initialHtml: string;
  portraitUrl: string | null;
}) {
  const [url, setUrl] = useState(portraitUrl);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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

  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    scheduleSave();
  }

  async function onPickPortrait(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/makers/${makerId}/portrait`, { method: "POST", body });
      const json = (await res.json()) as { url?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url ?? null);
    } catch {
      /* leave previous portrait; the button label resets */
    } finally {
      setUploading(false);
    }
  }

  async function removePortrait() {
    await fetch(`/api/makers/${makerId}/portrait`, { method: "DELETE" });
    setUrl(null);
  }

  const tbtn =
    "rounded-md border border-line-control bg-control px-2 py-1 text-[12px] font-medium text-ink-mid hover:text-ink-strong";

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
      {/* Portrait */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Representative image
        </p>
        <div className="jvb-hatch mt-2 aspect-[3/4] w-full overflow-hidden rounded-[11px] border border-line bg-band">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Portrait" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onPickPortrait(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid disabled:opacity-60"
          >
            {uploading ? "Uploading…" : url ? "Replace" : "Upload portrait"}
          </button>
          {url ? (
            <button type="button" onClick={() => void removePortrait()} className="text-[12px] text-ink-soft hover:text-ink-strong">
              Remove
            </button>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">Ideally a portrait of the maker; used on profile PDFs and web pages.</p>
      </div>

      {/* Rich text profile */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Profile</p>
          <span className={`text-[11px] ${status === "error" ? "text-oranje" : "text-ink-soft"}`}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Couldn’t save" : ""}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => cmd("bold")} className={`${tbtn} font-bold`}>B</button>
          <button type="button" onClick={() => cmd("italic")} className={`${tbtn} italic`}>I</button>
          <button type="button" onClick={() => cmd("underline")} className={`${tbtn} underline`}>U</button>
          <button type="button" onClick={() => cmd("formatBlock", "<h2>")} className={tbtn}>H2</button>
          <button type="button" onClick={() => cmd("formatBlock", "<h3>")} className={tbtn}>H3</button>
          <button type="button" onClick={() => cmd("formatBlock", "<p>")} className={tbtn}>¶</button>
          <button type="button" onClick={() => cmd("insertUnorderedList")} className={tbtn}>• List</button>
          <button type="button" onClick={() => cmd("insertOrderedList")} className={tbtn}>1. List</button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={scheduleSave}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void save();
          }}
          className="prose-maker mt-2 min-h-[260px] w-full rounded-[11px] border border-line-control bg-control px-4 py-3 text-[14px] leading-[1.6] text-ink-body focus:outline-none focus:ring-1 focus:ring-oranje/50 [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
        <p className="mt-1.5 text-[11px] text-ink-soft">
          Autosaves as you type. This text feeds the maker profile PDF and website page.
        </p>
      </div>
    </div>
  );
}

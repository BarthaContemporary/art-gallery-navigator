"use client";

import { useCallback, useEffect, useState } from "react";
import { previewKind, signDocumentUrl, type PreviewKind } from "@/lib/document-files";

/**
 * In-place preview for uploaded files. Click signs a short-lived URL and
 * opens a full-screen overlay: PDFs render in an iframe, images through the
 * storage image transform (a ~1600px JPEG instead of a multi-MB scan; it
 * also decodes HEIC/TIFF for browsers that can't); anything else (docx…)
 * gets a friendly fallback. Esc, the scrim, or ✕ closes it.
 */

const actionBtn =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid transition-transform duration-100 hover:text-ink-strong active:scale-[0.97]";

// Long enough that "Open in new tab" still works after a leisurely read.
const URL_TTL_SECONDS = 1800;

type Signed = { url: string; previewUrl: string; kind: PreviewKind };

function Overlay({ title, file, onClose }: { title: string; file: Signed; onClose: () => void }) {
  // Some formats still fail in <img> (e.g. an odd TIFF); fall back gracefully.
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    // Esc reaches this listener while focus is on our own chrome. Once the
    // user clicks into a cross-origin PDF iframe, key events stay inside it —
    // the ✕ button and the scrim remain as the ways out.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Preview: ${title}`}>
      <div
        className="jvb-scrim-enter absolute inset-0"
        style={{ background: "var(--jvb-bg-overlay)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />
      <div className="jvb-pop-enter absolute inset-2 flex flex-col overflow-hidden rounded-[13px] border border-line bg-cell shadow-2xl sm:inset-6 lg:inset-10">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-strong">
            {title}
          </span>
          <a href={file.url} target="_blank" rel="noreferrer" className={actionBtn}>
            Open in new tab ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            className={actionBtn}
            aria-label="Close preview"
            autoFocus
          >
            Close ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-band/40">
          {file.kind === "pdf" ? (
            <iframe src={file.url} title={title} className="h-full w-full" />
          ) : file.kind === "image" && !imgFailed ? (
            <div className="flex h-full items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.previewUrl}
                alt={title}
                onError={() => setImgFailed(true)}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-center text-[13.5px] text-ink-body">
              No in-browser preview for this file type — use “Open in new tab” above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FilePreviewLink({
  storagePath,
  title,
  className,
  children,
}: {
  storagePath: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [file, setFile] = useState<Signed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setFile(null), []);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const kind = previewKind(storagePath);
      const url = await signDocumentUrl(storagePath, URL_TTL_SECONDS);
      const previewUrl =
        kind === "image"
          ? await signDocumentUrl(storagePath, URL_TTL_SECONDS, { width: 1600, quality: 80 })
          : url;
      setFile({ url, previewUrl, kind });
    } catch {
      setError("Could not open the file — reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={className}
        title={`${title} — click to preview`}
      >
        {children}
        {error ? <span className="block text-[11px] font-normal text-ink-soft">{error}</span> : null}
      </button>
      {file ? <Overlay title={title} file={file} onClose={close} /> : null}
    </>
  );
}

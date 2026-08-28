"use client";

import { useEffect, useState } from "react";
import { createClient } from "@jvb/db/browser";

/**
 * In-place preview for uploaded files (piece-documents bucket). Click signs a
 * short-lived URL and opens a full-screen overlay: PDFs render in an iframe,
 * images in an <img>; anything else (docx, tiff…) gets a friendly fallback
 * with open/download links. Esc, the scrim, or ✕ closes it.
 */

type PreviewKind = "image" | "pdf" | "other";

function kindOf(path: string): PreviewKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

const actionBtn =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid transition-transform duration-100 hover:text-ink-strong active:scale-[0.97]";

function Overlay({
  title,
  url,
  kind,
  onClose,
}: {
  title: string;
  url: string;
  kind: PreviewKind;
  onClose: () => void;
}) {
  // Some formats (HEIC outside Safari, odd TIFFs) fail in <img>; fall back.
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fallback = (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-[13.5px] text-ink-body">
        No in-browser preview for this file type.
      </p>
      <a href={url} target="_blank" rel="noreferrer" className={actionBtn}>
        Open in new tab ↗
      </a>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Preview: ${title}`}>
      <div
        className="jvb-scrim-enter absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="jvb-pop-enter absolute inset-2 flex flex-col overflow-hidden rounded-[13px] border border-line bg-cell shadow-2xl sm:inset-6 lg:inset-10">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-strong">
            {title}
          </span>
          <a href={url} target="_blank" rel="noreferrer" className={`${actionBtn} hidden sm:inline-block`}>
            Open in new tab ↗
          </a>
          <button type="button" onClick={onClose} className={actionBtn} aria-label="Close preview">
            Close ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-band/40">
          {kind === "pdf" ? (
            <iframe src={url} title={title} className="h-full w-full" />
          ) : kind === "image" && !imgFailed ? (
            <div className="flex h-full items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={title}
                onError={() => setImgFailed(true)}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            fallback
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
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.storage
      .from("piece-documents")
      .createSignedUrl(storagePath, 600);
    setBusy(false);
    if (signErr || !data?.signedUrl) {
      setError("Could not open the file — reload the page and try again.");
      return;
    }
    setUrl(data.signedUrl);
  }

  return (
    <>
      <button type="button" onClick={open} className={className} title="Click to preview">
        {children}
      </button>
      {error ? <span className="text-[11.5px] text-ink-soft">{error}</span> : null}
      {url ? (
        <Overlay title={title} url={url} kind={kindOf(storagePath)} onClose={() => setUrl(null)} />
      ) : null}
    </>
  );
}

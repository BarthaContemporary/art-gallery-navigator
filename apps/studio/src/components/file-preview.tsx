"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { previewKind, signDocumentUrl, type PreviewKind } from "@/lib/document-files";
import { Button, ButtonLink } from "@/components/ui/button";
import { CloseIcon, ExternalIcon } from "@/components/ui/icons";
import { useModalFocus } from "@/components/use-modal-focus";

/**
 * In-place preview for uploaded files. Click signs a short-lived URL and
 * opens a full-screen overlay: PDFs render in an iframe, images through the
 * storage image transform (a ~1600px JPEG instead of a multi-MB scan; it
 * also decodes HEIC/TIFF for browsers that can't); anything else (docx…)
 * gets a friendly fallback. Esc, the scrim, or the Close button closes it.
 * The overlay is drawn as the spec's dialog: page fill, a rule-strong edge
 * and the pop shadow over the scrim.
 */

// Long enough that "Open in new tab" still works after a leisurely read.
const URL_TTL_SECONDS = 1800;

type Signed = { url: string; previewUrl: string; kind: PreviewKind };

function Overlay({
  title,
  file,
  onClose,
  opener,
}: {
  title: string;
  file: Signed;
  onClose: () => void;
  /** The link that opened it: focus goes back there on close. */
  opener: RefObject<HTMLButtonElement | null>;
}) {
  // Some formats still fail in <img> (e.g. an odd TIFF); fall back gracefully.
  const [imgFailed, setImgFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A modal layer: focus starts on Close, Tab stays inside, Escape closes
  // it, and focus goes back to the link that opened it. Esc reaches this
  // while focus is on our own chrome; once the user clicks into a
  // cross-origin PDF iframe, key events stay inside it, and the Close button
  // and the scrim remain as the ways out.
  useModalFocus(true, dialogRef, {
    initial: () => closeRef.current,
    returnTo: () => opener.current,
    onEscape: onClose,
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${title}`}
    >
      <div
        className="jvb-scrim-enter absolute inset-0"
        style={{ background: "var(--jvb-scrim)" }}
        onClick={onClose}
        aria-hidden
      />
      <div className="jvb-pop-enter absolute inset-2 flex flex-col overflow-hidden border border-rule-strong bg-page shadow-[var(--jvb-shadow-pop)] sm:inset-6 lg:inset-10">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2 sm:px-4">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-[1.45] text-ink">
            {title}
          </span>
          <ButtonLink
            href={file.url}
            native
            target="_blank"
            rel="noreferrer"
            size="sm"
            icon={<ExternalIcon size={14} />}
          >
            Open in new tab
          </ButtonLink>
          <Button ref={closeRef} iconOnly label="Close preview" size="sm" onClick={onClose}>
            <CloseIcon size={14} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 bg-band">
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
            <p className="flex h-full items-center justify-center p-6 text-center text-[13.5px] leading-[1.5] text-body">
              This type of file has no preview here. Use “Open in new tab” above.
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
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      setError("Could not open the file. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        disabled={busy}
        className={className}
        title={`Preview ${title}`}
      >
        {children}
        {error ? <span className="block text-[12px] font-normal leading-[1.4] text-danger">{error}</span> : null}
      </button>
      {file ? <Overlay title={title} file={file} onClose={close} opener={buttonRef} /> : null}
    </>
  );
}

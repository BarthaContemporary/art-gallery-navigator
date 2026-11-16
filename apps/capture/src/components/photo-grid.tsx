"use client";

import { IconClose } from "@/components/icons";

export type Photo = {
  id: string;
  /** A small preview made on the phone (never the full-size original). */
  url: string;
  is_label: boolean;
  uploading?: boolean;
  /** Why the photo is not saved; it stays on screen to try again. */
  failed?: string;
};

export function PhotoGrid({
  photos,
  onRemove,
  onRetry,
}: {
  photos: Photo[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-line-control text-[12.5px] text-ink-soft">
        No photos yet
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {photos.map((p) => (
        <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt=""
            decoding="async"
            className={`h-full w-full object-cover ${p.uploading || p.failed ? "opacity-50" : ""}`}
          />
          {p.is_label ? (
            <span className="absolute left-1 top-1 rounded bg-oranje px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
              Label
            </span>
          ) : null}
          {p.uploading ? (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] text-ink-body">…</span>
          ) : (
            <>
              {p.failed ? (
                <button
                  onClick={() => onRetry?.(p.id)}
                  title={p.failed}
                  className="absolute inset-x-1 bottom-1 rounded-md bg-danger px-1 py-1 text-[10.5px] font-semibold text-white"
                >
                  Not saved · Retry
                </button>
              ) : null}
              <button
                onClick={() => onRemove(p.id)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

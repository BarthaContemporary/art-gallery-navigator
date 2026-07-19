"use client";

export type Photo = {
  id: string;
  url: string;
  is_label: boolean;
  uploading?: boolean;
};

export function PhotoGrid({ photos, onRemove }: { photos: Photo[]; onRemove: (id: string) => void }) {
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
          <img src={p.url} alt="" className={`h-full w-full object-cover ${p.uploading ? "opacity-50" : ""}`} />
          {p.is_label ? (
            <span className="absolute left-1 top-1 rounded bg-oranje px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
              Label
            </span>
          ) : null}
          {p.uploading ? (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] text-ink-body">…</span>
          ) : (
            <button
              onClick={() => onRemove(p.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[13px] leading-none text-white"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

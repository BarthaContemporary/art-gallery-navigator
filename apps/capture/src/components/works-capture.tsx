"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { uploadToCaptures } from "@/lib/browser";
import { PhotoGrid, type Photo } from "@/components/photo-grid";
import { SourceBar } from "@/components/source-bar";
import { SwipeToDelete } from "@/components/swipe-to-delete";

type Fields = {
  maker: string;
  title: string;
  year: string;
  medium: string;
  dimensions_text: string;
  period: string;
  origin_region: string;
  category: string;
  notes: string;
};

type Work = {
  id: string;
  photos: Photo[];
  fields: Fields;
  labelDetected: boolean;
  detecting: boolean;
  detected: boolean;
  more: boolean;
};

const EMPTY: Fields = {
  maker: "",
  title: "",
  year: "",
  medium: "",
  dimensions_text: "",
  period: "",
  origin_region: "",
  category: "",
  notes: "",
};

export function WorksCapture() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [source, setSource] = useState<{
    name: string | null;
    address: string | null;
    type: string | null;
  }>({ name: null, address: null, type: null });
  const [works, setWorks] = useState<Work[]>([]);
  const [starting, setStarting] = useState(true);
  const started = useRef(false);

  // Ref mirror of `works` so async handlers can read the current value.
  const worksRef = useRef<Work[]>([]);
  function update(updater: (prev: Work[]) => Work[]) {
    setWorks((prev) => {
      const next = updater(prev);
      worksRef.current = next;
      return next;
    });
  }
  const get = (id: string) => worksRef.current.find((w) => w.id === id);
  const patchWork = (id: string, up: Partial<Work>) =>
    update((ws) => ws.map((w) => (w.id === id ? { ...w, ...up } : w)));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const coords = await getCoords();
      const res = await fetch("/api/capture/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coords ?? {}),
      });
      const { batch } = (await res.json()) as {
        batch?: {
          id: string;
          source_name: string | null;
          source_address: string | null;
          source_type: string | null;
        };
      };
      if (batch) {
        setBatchId(batch.id);
        setSource({ name: batch.source_name, address: batch.source_address, type: batch.source_type });
        await addWork(batch.id, 0);
      }
      setStarting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addWork(bId: string, sortOrder: number) {
    const res = await fetch("/api/capture/work", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId: bId, sortOrder }),
    });
    const { work } = (await res.json()) as { work?: { id: string } };
    if (work)
      update((w) => [
        ...w,
        { id: work.id, photos: [], fields: { ...EMPTY }, labelDetected: false, detecting: false, detected: false, more: false },
      ]);
  }

  async function saveFields(id: string) {
    const w = get(id);
    if (!w) return;
    await fetch("/api/capture/work", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...w.fields }),
    });
  }

  async function onPickPhotos(workId: string, files: FileList | null) {
    if (!files || !batchId) return;
    for (const file of Array.from(files)) {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      const localUrl = URL.createObjectURL(file);
      const startLen = get(workId)?.photos.length ?? 0;
      patchWork(workId, {
        photos: [...(get(workId)?.photos ?? []), { id: tempId, url: localUrl, is_label: false, uploading: true }],
      });
      try {
        const { path, width, height } = await uploadToCaptures(file, "work", { batchId, workId });
        const res = await fetch(`/api/capture/work/${workId}/photo`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, batchId, width, height, sortOrder: startLen }),
        });
        const { photo, url } = (await res.json()) as { photo?: { id: string }; url?: string };
        update((ws) =>
          ws.map((w) =>
            w.id === workId
              ? {
                  ...w,
                  photos: w.photos.map((p) =>
                    p.id === tempId ? { id: photo?.id ?? tempId, url: url ?? localUrl, is_label: false, uploading: false } : p,
                  ),
                }
              : w,
          ),
        );
      } catch {
        update((ws) => ws.map((w) => (w.id === workId ? { ...w, photos: w.photos.filter((p) => p.id !== tempId) } : w)));
      }
    }
    const w = get(workId);
    if (w && !w.detected && !w.detecting) detectLabel(workId);
  }

  async function detectLabel(id: string) {
    patchWork(id, { detecting: true });
    try {
      const res = await fetch(`/api/capture/work/${id}/detect`, { method: "POST" });
      const data = (await res.json()) as Record<string, unknown> & { configured?: boolean; label_found?: boolean };
      if (data.configured === false) {
        patchWork(id, { detecting: false, detected: true });
        return;
      }
      const up: Partial<Fields> = {};
      const keys: (keyof Fields)[] = ["maker", "title", "year", "medium", "period", "origin_region", "category", "notes"];
      for (const k of keys) if (typeof data[k] === "string" && (data[k] as string).trim()) up[k] = data[k] as string;
      if (typeof data.dimensions === "string" && data.dimensions.trim()) up.dimensions_text = data.dimensions;
      update((ws) =>
        ws.map((w) =>
          w.id === id
            ? {
                ...w,
                fields: { ...w.fields, ...up },
                labelDetected: Boolean(data.label_found),
                detecting: false,
                detected: true,
                more: w.more || Boolean(up.period || up.origin_region || up.category || up.notes),
              }
            : w,
        ),
      );
    } catch {
      patchWork(id, { detecting: false, detected: true });
    }
  }

  async function removePhoto(workId: string, photoId: string) {
    patchWork(workId, { photos: (get(workId)?.photos ?? []).filter((p) => p.id !== photoId) });
    if (!photoId.startsWith("tmp-")) await fetch(`/api/capture/photo/${photoId}`, { method: "DELETE" });
  }

  async function removeWork(id: string) {
    update((ws) => ws.filter((w) => w.id !== id));
    await fetch(`/api/capture/work?id=${id}`, { method: "DELETE" });
  }

  if (starting) {
    return <p className="py-16 text-center text-[13.5px] text-ink-muted">Starting capture…</p>;
  }

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink-strong">New work(s)</h1>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>

      {batchId ? <SourceBar batchId={batchId} source={source} onChange={setSource} /> : null}

      <div className="mt-4 space-y-5">
        {works.map((w, i) => (
          <SwipeToDelete key={w.id} confirmText="Delete this work and its photos?" onDelete={() => removeWork(w.id)}>
            <WorkCard
              index={i}
              work={w}
              onPickPhotos={(files) => onPickPhotos(w.id, files)}
              onRemovePhoto={(pid) => removePhoto(w.id, pid)}
              onField={(up) => patchWork(w.id, { fields: { ...(get(w.id)?.fields ?? w.fields), ...up } })}
              onBlur={() => saveFields(w.id)}
              onDetect={() => detectLabel(w.id)}
              onToggleMore={() => patchWork(w.id, { more: !get(w.id)?.more })}
              onRemove={() => removeWork(w.id)}
            />
          </SwipeToDelete>
        ))}
      </div>

      <button
        onClick={() => batchId && addWork(batchId, works.length)}
        className="tap mt-5 w-full rounded-xl border border-dashed border-line-control bg-cell font-medium text-ink-body active:bg-control/50"
      >
        + Add another work
      </button>

      <div className="safe-bottom sticky bottom-0 mt-6 flex gap-2 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <Link
          href={batchId ? `/invoices/new?batch=${batchId}` : "/invoices/new"}
          className="tap flex flex-1 items-center justify-center rounded-xl border border-line-control bg-control font-medium text-ink-body"
        >
          Capture invoice
        </Link>
        <Link href="/review" className="tap flex flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg">
          Done
        </Link>
      </div>
    </div>
  );
}

function WorkCard({
  index,
  work,
  onPickPhotos,
  onRemovePhoto,
  onField,
  onBlur,
  onDetect,
  onToggleMore,
  onRemove,
}: {
  index: number;
  work: Work;
  onPickPhotos: (files: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  onField: (up: Partial<Fields>) => void;
  onBlur: () => void;
  onDetect: () => void;
  onToggleMore: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const f = work.fields;

  return (
    <section className="rounded-2xl border border-line bg-cell p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Work {index + 1}</h2>
        <button onClick={onRemove} className="text-[12px] text-ink-soft">Remove</button>
      </div>

      <PhotoGrid photos={work.photos} onRemove={onRemovePhoto} />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          onPickPhotos(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="tap flex-1 rounded-xl border border-line-control bg-control text-[14px] font-medium text-ink-body active:bg-control-active"
        >
          📷 Add photos
        </button>
        {work.photos.length > 0 ? (
          <button
            onClick={onDetect}
            disabled={work.detecting}
            className="tap rounded-xl border border-line-control bg-cell px-4 text-[13px] font-medium text-ink-body disabled:opacity-50"
          >
            {work.detecting ? "Reading…" : "Re-read label"}
          </button>
        ) : null}
      </div>

      {work.detected ? (
        <p className="mt-2 text-[12px] text-ink-soft">
          {work.labelDetected ? "✓ Label read — check the details below." : "No label detected — enter details below."}
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        <Field label="Maker" value={f.maker} onChange={(v) => onField({ maker: v })} onBlur={onBlur} />
        <Field label="Title" value={f.title} onChange={(v) => onField({ title: v })} onBlur={onBlur} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year" value={f.year} onChange={(v) => onField({ year: v })} onBlur={onBlur} />
          <Field label="Dimensions" value={f.dimensions_text} onChange={(v) => onField({ dimensions_text: v })} onBlur={onBlur} />
        </div>
        <Field label="Medium" value={f.medium} onChange={(v) => onField({ medium: v })} onBlur={onBlur} />

        {work.more ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period" value={f.period} onChange={(v) => onField({ period: v })} onBlur={onBlur} />
              <Field label="Origin" value={f.origin_region} onChange={(v) => onField({ origin_region: v })} onBlur={onBlur} />
            </div>
            <Field label="Category" value={f.category} onChange={(v) => onField({ category: v })} onBlur={onBlur} />
            <Field label="Notes" value={f.notes} onChange={(v) => onField({ notes: v })} onBlur={onBlur} textarea />
          </>
        ) : null}

        <button onClick={onToggleMore} className="text-[12.5px] font-medium text-oranje">
          {work.more ? "Fewer fields" : "More fields"}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-faint">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-ink"
        />
      )}
    </label>
  );
}

function getCoords(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

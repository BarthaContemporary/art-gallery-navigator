"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeThumbnail, uploadToCaptures } from "@/lib/browser";
import { text } from "@/lib/capture-values";
import { jsonBody, messageOf, requestJson } from "@/lib/request";
import { PhotoGrid, type Photo } from "@/components/photo-grid";
import { SourceBar } from "@/components/source-bar";
import { SwipeToDelete } from "@/components/swipe-to-delete";
import { IconCamera, IconCheck } from "@/components/icons";

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
  /** Why the last label reading failed (a limit, a model error, no signal). */
  detectError: string | null;
  /** Automatic readings started so far (capped). */
  autoReads: number;
  /** Fields changed since they were last saved. */
  dirty: boolean;
  saveError: string | null;
  more: boolean;
};

type BatchRow = {
  id: string;
  captured_at: string;
  source_name: string | null;
  source_address: string | null;
  source_type: string | null;
  ledger?: "jvb" | "external" | null;
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

/** Reply key → field (the label reading calls dimensions "dimensions"). */
const DETECTED: [string, keyof Fields][] = [
  ["maker", "maker"],
  ["title", "title"],
  ["year", "year"],
  ["medium", "medium"],
  ["dimensions", "dimensions_text"],
  ["period", "period"],
  ["origin_region", "origin_region"],
  ["category", "category"],
  ["notes", "notes"],
];

/** Wait this long after the last finished upload before reading the label. */
const AUTO_READ_DELAY_MS = 2000;
/** Automatic label readings per work; "Re-read label" is always there. */
const MAX_AUTO_READS = 4;

const newWork = (id: string): Work => ({
  id,
  photos: [],
  fields: { ...EMPTY },
  labelDetected: false,
  detecting: false,
  detected: false,
  detectError: null,
  autoReads: 0,
  dirty: false,
  saveError: null,
  more: false,
});

const isEmptyWork = (w: Work) => w.photos.length === 0 && Object.values(w.fields).every((v) => !v.trim());

export function WorksCapture() {
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [source, setSource] = useState<{
    name: string | null;
    address: string | null;
    type: string | null;
    ledger?: "jvb" | "external" | null;
  }>({ name: null, address: null, type: null, ledger: "jvb" });
  const [works, setWorks] = useState<Work[]>([]);
  const [phase, setPhase] = useState<"starting" | "ready" | "failed">("starting");
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);
  const cancelled = useRef(false);
  const batchRef = useRef<string | null>(null);
  const coords = useRef<Promise<Coords | null> | null>(null);

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
  const setPhoto = (workId: string, photoId: string, up: Partial<Photo>) =>
    update((ws) =>
      ws.map((w) => (w.id === workId ? { ...w, photos: w.photos.map((p) => (p.id === photoId ? { ...p, ...up } : p)) } : w)),
    );

  // Files of photos not yet saved (to retry), what of them already reached
  // storage, the previews to revoke, and pending automatic label readings.
  const pendingFiles = useRef(new Map<string, File>());
  const uploaded = useRef(new Map<string, { path: string; width: number; height: number }>());
  const previews = useRef(new Set<string>());
  const autoTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  async function start() {
    setPhase("starting");
    setStartError(null);
    try {
      coords.current ??= getCoords();
      if (!batchRef.current) {
        const c = await coords.current;
        if (cancelled.current) return;
        const { batch: b } = await requestJson<{ batch?: BatchRow }>("/api/capture/batch", jsonBody("POST", c ?? {}));
        if (!b?.id) throw new Error("The purchase could not be started. Try again.");
        batchRef.current = b.id;
        setBatch(b);
        setSource({ name: b.source_name, address: b.source_address, type: b.source_type, ledger: b.ledger ?? "jvb" });
        if (cancelled.current) {
          tidy();
          return;
        }
      }
      if (worksRef.current.length === 0) await addWork(0, true);
      setPhase("ready");
    } catch (e) {
      setStartError(messageOf(e, "Capture could not start. Try again."));
      setPhase("failed");
    }
  }

  useEffect(() => {
    cancelled.current = false;
    if (!started.current) {
      started.current = true;
      void start();
    }
    const onHide = (e: PageTransitionEvent) => {
      if (!e.persisted) tidy();
    };
    window.addEventListener("pagehide", onHide);
    const timers = autoTimers.current;
    const urls = previews.current;
    return () => {
      cancelled.current = true;
      window.removeEventListener("pagehide", onHide);
      tidy();
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Leaving the screen: unsaved fields are saved, a label reading that was
   * about to start is started, and works left empty (no photo, no text) are
   * removed, the purchase with them if nothing is left in it. Requests use
   * keepalive so they finish after the page has gone.
   */
  function tidy() {
    const bId = batchRef.current;
    if (!bId) return;
    const keep = { keepalive: true } as const;
    for (const [workId, t] of autoTimers.current) {
      clearTimeout(t);
      fetch(`/api/capture/work/${workId}/detect`, { ...jsonBody("POST", { mode: "auto" }), ...keep }).catch(() => undefined);
    }
    autoTimers.current.clear();
    const ws = worksRef.current;
    for (const w of ws) {
      if (isEmptyWork(w)) {
        fetch(`/api/capture/work?id=${encodeURIComponent(w.id)}`, { method: "DELETE", ...keep }).catch(() => undefined);
      } else if (w.dirty) {
        fetch("/api/capture/work", { ...jsonBody("PATCH", { id: w.id, ...w.fields }), ...keep }).catch(() => undefined);
      }
    }
    if (ws.length === 0) {
      fetch(`/api/capture/batch/${encodeURIComponent(bId)}?ifEmpty=1`, { method: "DELETE", ...keep }).catch(() => undefined);
    }
  }

  /** Create a work on the server; throws when `rethrow`, else shows why. */
  async function addWork(sortOrder: number, rethrow = false) {
    const bId = batchRef.current;
    if (!bId) return;
    try {
      const { work } = await requestJson<{ work?: { id: string } }>("/api/capture/work", jsonBody("POST", { batchId: bId, sortOrder }));
      if (!work?.id) throw new Error("The work could not be added. Try again.");
      update((w) => [...w, newWork(work.id)]);
    } catch (e) {
      if (rethrow) throw e;
      setNotice(messageOf(e, "The work could not be added. Try again."));
    }
  }

  async function saveFields(id: string) {
    const w = get(id);
    if (!w || !w.dirty) return;
    const sent = w.fields;
    try {
      await requestJson("/api/capture/work", jsonBody("PATCH", { id, ...sent }));
      // Still dirty if more was typed while this was on its way.
      update((ws) => ws.map((x) => (x.id === id ? { ...x, saveError: null, dirty: x.fields !== sent } : x)));
    } catch (e) {
      patchWork(id, { saveError: messageOf(e, "Not saved. Try again.") });
    }
  }

  async function onPickPhotos(workId: string, files: FileList | null) {
    if (!files || !batchRef.current) return;
    for (const file of Array.from(files)) {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      pendingFiles.current.set(tempId, file);
      const preview = await makeThumbnail(file);
      previews.current.add(preview);
      patchWork(workId, {
        photos: [...(get(workId)?.photos ?? []), { id: tempId, url: preview, is_label: false, uploading: true }],
      });
      await savePhoto(workId, tempId);
    }
    scheduleAutoRead(workId);
  }

  /** Upload a photo and record it; a tile is saved only once a row id came back. */
  async function savePhoto(workId: string, tempId: string) {
    const file = pendingFiles.current.get(tempId);
    const bId = batchRef.current;
    if (!file || !bId) return;
    setPhoto(workId, tempId, { uploading: true, failed: undefined });
    try {
      let stored = uploaded.current.get(tempId);
      if (!stored) {
        stored = await uploadToCaptures(file, "work", { batchId: bId, workId });
        uploaded.current.set(tempId, stored);
      }
      const sortOrder = Math.max(0, get(workId)?.photos.findIndex((p) => p.id === tempId) ?? 0);
      const { photo } = await requestJson<{ photo?: { id: string } }>(
        `/api/capture/work/${workId}/photo`,
        jsonBody("POST", { ...stored, batchId: bId, sortOrder }),
      );
      if (!photo?.id) throw new Error("The photo was not recorded. Try again.");
      pendingFiles.current.delete(tempId);
      uploaded.current.delete(tempId);
      setPhoto(workId, tempId, { id: photo.id, uploading: false, failed: undefined });
    } catch (e) {
      setPhoto(workId, tempId, { uploading: false, failed: messageOf(e, "Not saved. Try again.") });
    }
  }

  async function retryPhoto(workId: string, photoId: string) {
    await savePhoto(workId, photoId);
    scheduleAutoRead(workId);
  }

  /**
   * Read the label by itself once photos have arrived (a phone camera hands
   * over one photo per pick, and the label is often the second or third),
   * a little after the last upload, until a label is found.
   */
  function scheduleAutoRead(workId: string) {
    const w = get(workId);
    if (!w || w.labelDetected || w.autoReads >= MAX_AUTO_READS) return;
    if (!w.photos.some((p) => !p.id.startsWith("tmp-"))) return;
    const old = autoTimers.current.get(workId);
    if (old) clearTimeout(old);
    autoTimers.current.set(
      workId,
      setTimeout(() => {
        autoTimers.current.delete(workId);
        const now = get(workId);
        if (!now || now.labelDetected) return;
        if (now.detecting || now.photos.some((p) => p.uploading)) scheduleAutoRead(workId);
        else void detectLabel(workId, "auto");
      }, AUTO_READ_DELAY_MS),
    );
  }

  /** Start any automatic reading that is waiting, now (Add another work). */
  function flushAutoReads() {
    for (const [workId, t] of autoTimers.current) {
      clearTimeout(t);
      autoTimers.current.delete(workId);
      const w = get(workId);
      if (w && !w.detecting && !w.labelDetected) void detectLabel(workId, "auto");
    }
  }

  /**
   * "auto": fill only fields that are still empty (here and on the server),
   * so nothing typed meanwhile is replaced. "manual" (Re-read label): the
   * label's values replace what is there.
   */
  async function detectLabel(id: string, mode: "auto" | "manual") {
    const w = get(id);
    if (!w) return;
    patchWork(id, { detecting: true, detectError: null, ...(mode === "auto" ? { autoReads: w.autoReads + 1 } : {}) });
    try {
      const data = await requestJson<Record<string, unknown>>(
        `/api/capture/work/${id}/detect`,
        jsonBody("POST", mode === "auto" ? { mode: "auto" } : {}),
      );
      if (data.configured === false) {
        // Label reading is not set up here: say nothing more, try no more.
        patchWork(id, { detecting: false, detected: true, autoReads: MAX_AUTO_READS });
        return;
      }
      const up: Partial<Fields> = {};
      for (const [key, field] of DETECTED) {
        const v = text(data[key]);
        if (v) up[field] = v;
      }
      const labelPhotoId = typeof data.label_photo_id === "string" ? data.label_photo_id : null;
      update((ws) =>
        ws.map((x) => {
          if (x.id !== id) return x;
          const fields = { ...x.fields };
          for (const [k, v] of Object.entries(up) as [keyof Fields, string][]) {
            if (mode === "manual" || !fields[k].trim()) fields[k] = v;
          }
          return {
            ...x,
            fields,
            labelDetected: data.label_found === true,
            detecting: false,
            detected: true,
            photos: x.photos.map((p) => ({ ...p, is_label: labelPhotoId !== null && p.id === labelPhotoId })),
            more: x.more || Boolean(up.period || up.origin_region || up.category || up.notes),
          };
        }),
      );
    } catch (e) {
      patchWork(id, { detecting: false, detectError: `Could not read the label: ${messageOf(e, "try again.")}` });
    }
  }

  function dropPreviews(photos: Photo[]) {
    for (const p of photos) {
      if (previews.current.delete(p.url)) URL.revokeObjectURL(p.url);
    }
  }

  async function removePhoto(workId: string, photoId: string) {
    const before = get(workId)?.photos ?? [];
    const index = before.findIndex((p) => p.id === photoId);
    const photo = before[index];
    if (!photo) return;
    patchWork(workId, { photos: before.filter((p) => p.id !== photoId) });
    if (photoId.startsWith("tmp-")) {
      pendingFiles.current.delete(photoId);
      uploaded.current.delete(photoId);
      dropPreviews([photo]);
      return;
    }
    try {
      await requestJson(`/api/capture/photo/${photoId}`, { method: "DELETE" });
      dropPreviews([photo]);
    } catch (e) {
      // Put it back where it was: it is still saved.
      update((ws) =>
        ws.map((w) => {
          if (w.id !== workId || w.photos.some((p) => p.id === photoId)) return w;
          const photos = [...w.photos];
          photos.splice(Math.min(index, photos.length), 0, photo);
          return { ...w, photos };
        }),
      );
      setNotice(messageOf(e, "The photo could not be removed. Try again."));
    }
  }

  async function removeWork(id: string) {
    const index = worksRef.current.findIndex((w) => w.id === id);
    const work = worksRef.current[index];
    if (!work) return;
    const t = autoTimers.current.get(id);
    if (t) clearTimeout(t);
    autoTimers.current.delete(id);
    update((ws) => ws.filter((w) => w.id !== id));
    try {
      // keepBatch: this screen goes on adding works to the purchase.
      await requestJson(`/api/capture/work?id=${encodeURIComponent(id)}&keepBatch=1`, { method: "DELETE" });
      dropPreviews(work.photos);
    } catch (e) {
      update((ws) => {
        if (ws.some((w) => w.id === id)) return ws;
        const next = [...ws];
        next.splice(Math.min(index, next.length), 0, work);
        return next;
      });
      setNotice(messageOf(e, "The work could not be deleted. Try again."));
    }
  }

  if (phase !== "ready") {
    return (
      <div className="py-16 text-center">
        {phase === "starting" ? (
          <p className="text-[13.5px] text-ink-muted">Starting capture…</p>
        ) : (
          <>
            <p className="text-[13.5px] text-danger">{startError}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => void start()}
                className="tap rounded-xl bg-primary px-5 font-semibold text-primary-fg"
              >
                Try again
              </button>
              <Link href="/" className="tap flex items-center rounded-xl border border-line-control bg-control px-5 font-medium text-ink-body">
                Home
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink-strong">New work(s)</h1>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>

      {batch ? (
        <SourceBar batchId={batch.id} capturedAt={batch.captured_at} source={source} onChange={setSource} />
      ) : null}

      {notice ? (
        <button
          onClick={() => setNotice(null)}
          className="mt-3 w-full rounded-lg border border-line bg-band px-3 py-2 text-left text-[12.5px] text-danger"
        >
          {notice} <span className="text-ink-soft">(tap to close)</span>
        </button>
      ) : null}

      <div className="mt-4 space-y-5">
        {works.map((w, i) => (
          <SwipeToDelete key={w.id} confirmText="Delete this work and its photos?" onDelete={() => removeWork(w.id)}>
            <WorkCard
              index={i}
              work={w}
              onPickPhotos={(files) => onPickPhotos(w.id, files)}
              onRemovePhoto={(pid) => removePhoto(w.id, pid)}
              onRetryPhoto={(pid) => retryPhoto(w.id, pid)}
              onField={(up) =>
                patchWork(w.id, { fields: { ...(get(w.id)?.fields ?? w.fields), ...up }, dirty: true })
              }
              onBlur={() => saveFields(w.id)}
              onDetect={() => detectLabel(w.id, "manual")}
              onToggleMore={() => patchWork(w.id, { more: !get(w.id)?.more })}
              onRemove={() => {
                if (window.confirm("Delete this work and its photos?")) void removeWork(w.id);
              }}
            />
          </SwipeToDelete>
        ))}
      </div>

      <button
        onClick={() => {
          flushAutoReads();
          void addWork(works.length);
        }}
        className="tap mt-5 w-full rounded-xl border border-dashed border-line-control bg-cell font-medium text-ink-body active:bg-control/50"
      >
        + Add another work
      </button>

      <div className="safe-bottom sticky bottom-0 mt-6 flex gap-2 border-t border-line-soft bg-page/90 py-3 backdrop-blur">
        <Link
          href={batch ? `/invoices/new?batch=${batch.id}` : "/invoices/new"}
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
  onRetryPhoto,
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
  onRetryPhoto: (id: string) => void;
  onField: (up: Partial<Fields>) => void;
  onBlur: () => void;
  onDetect: () => void;
  onToggleMore: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const f = work.fields;
  const savedPhotos = work.photos.some((p) => !p.id.startsWith("tmp-"));

  return (
    <section className="rounded-2xl border border-line bg-cell p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Work {index + 1}</h2>
        <button onClick={onRemove} className="text-[12px] text-ink-soft">Remove</button>
      </div>

      <PhotoGrid photos={work.photos} onRemove={onRemovePhoto} onRetry={onRetryPhoto} />

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
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-control bg-control text-[14px] font-medium text-ink-body active:bg-control-active"
        >
          <IconCamera className="h-[18px] w-[18px]" /> Add photos
        </button>
        {savedPhotos ? (
          <button
            onClick={onDetect}
            disabled={work.detecting}
            className="tap rounded-xl border border-line-control bg-cell px-4 text-[13px] font-medium text-ink-body disabled:opacity-50"
          >
            {work.detecting ? "Reading…" : "Re-read label"}
          </button>
        ) : null}
      </div>

      {work.detectError ? (
        <p className="mt-2 text-[12px] text-danger">{work.detectError}</p>
      ) : work.detecting ? (
        <p className="mt-2 text-[12px] text-ink-soft">Reading the label…</p>
      ) : work.detected ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
          {work.labelDetected ? <IconCheck className="h-3.5 w-3.5 shrink-0 text-status-green" /> : null}
          {work.labelDetected
            ? "Label read — check the details below."
            : "No label found in these photos — add a photo of the label, or enter details below."}
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

        {work.saveError ? (
          <p className="flex items-center justify-between gap-2 text-[12px] text-danger">
            <span>{work.saveError}</span>
            <button onClick={onBlur} className="shrink-0 font-medium text-accent-deep">Retry</button>
          </p>
        ) : null}

        <button onClick={onToggleMore} className="text-[12.5px] font-medium text-accent-deep">
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

type Coords = { lat: number; lng: number; accuracy: number };

function getCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

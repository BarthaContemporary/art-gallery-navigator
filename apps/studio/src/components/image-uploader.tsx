"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/dropzone";
import { Panel } from "@/components/ui/section";

// The browser Supabase client is loaded when it is first needed (an upload,
// a delete, a signed link), not with the page: it is about 70 kB of the
// first-load JavaScript of the record, editor, images and shipment pages.
const browserClient = () => import("@jvb/db/browser").then((m) => m.createClient());

const ROLES = ["front", "back", "side", "signature", "box", "detail", "condition", "document", "other"];
// The stored role, as a word.
const roleWord = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

/*
 * Polling. One poller asks for every image still being processed in one
 * query, while this panel is mounted (it stops when the page is left; the
 * uploads and row inserts already started are not cancelled). Every
 * POLL_MS at first; an image not done within SLOW_AFTER_MS of its row being
 * written is shown as still queued (the worker takes the queue in turn) and
 * from then on asked about every SLOW_POLL_MS, so it still turns Ready if
 * the page stays open. A failed poll is tried again quietly; only
 * POLL_FAILURES_SHOWN in a row say "Can't check progress".
 */
const POLL_MS = 2500;
const SLOW_POLL_MS = 20_000;
const SLOW_AFTER_MS = 180_000;
const POLL_FAILURES_SHOWN = 3;

// queued: the row is written but the worker has not finished it in
// SLOW_AFTER_MS; it appears below when ready.
type Phase = "uploading" | "processing" | "queued" | "done" | "error";
type Item = {
  id: string;
  name: string;
  /** The role in force when the file was dropped: what it is filed as. */
  role: string;
  phase: Phase;
  progress: number;
  error?: string;
  /** When the piece_images row was written (the poller asks from then on). */
  registeredAt?: number;
};

/**
 * Uploads originals straight to the private `piece-originals` bucket, then
 * registers a pending piece_images row for the VPS image worker to process.
 * Each file shows a live status bar: real upload % (XHR against a signed
 * storage URL), then a "processing" phase that polls the row until the worker
 * has generated the web derivative (or reports an error). `capture` lets phones
 * shoot stock photos directly at fairs.
 */
export function ImageUploader({ pieceId, nextSortOrder }: { pieceId: string; nextSortOrder: number }) {
  const [role, setRole] = useState("front");
  const [items, setItems] = useState<Item[]>([]);
  const [pollTrouble, setPollTrouble] = useState(false);
  const pollFailures = useRef(0);
  const router = useRouter();

  const patch = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  async function uploadOne(file: File, sort: number, fileRole: string) {
    const supabase = await browserClient();
    const imageId = crypto.randomUUID();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${pieceId}/${imageId}.${ext}`;

    setItems((prev) => [...prev, { id: imageId, name: file.name, role: fileRole, phase: "uploading", progress: 0 }]);

    // 1. Signed upload URL (staff have storage-insert rights via RLS), so the
    //    file goes straight to storage and we can track real progress via XHR.
    const { data: signed, error: signErr } = await supabase.storage
      .from("piece-originals")
      .createSignedUploadUrl(path);
    if (signErr || !signed) {
      patch(imageId, { phase: "error", error: signErr?.message ?? "Could not start upload" });
      return;
    }

    // 2. PUT the original with progress events.
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) patch(imageId, { progress: e.loaded / e.total });
        };
        xhr.onload = () =>
          xhr.status < 400 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });
    } catch (e) {
      patch(imageId, { phase: "error", error: e instanceof Error ? e.message : "Upload failed" });
      return;
    }

    // 3. Register the pending row (file_size_bytes — the compat `bytes` column
    //    was dropped in migration 0048), filed under the role chosen when the
    //    file was dropped, not whatever the select shows now: an upload can
    //    take minutes, and the role decides what the website shows. The VPS
    //    worker picks it up from here.
    patch(imageId, { phase: "processing", progress: 1 });
    const { error: insErr } = await supabase.from("piece_images").insert({
      id: imageId,
      piece_id: pieceId,
      role: fileRole,
      sort_order: sort,
      storage_path_original: path,
      file_size_bytes: file.size,
      processing_status: "pending",
    });
    if (insErr) {
      patch(imageId, { phase: "error", error: insErr.message });
      return;
    }

    // 4. From here the poller below follows it until the worker is done.
    patch(imageId, { registeredAt: Date.now() });
  }

  // The images whose rows are written and not yet finished, and whether any
  // is still within its first SLOW_AFTER_MS (polled often) or all are queued.
  const pending = items.filter((it) => it.registeredAt && (it.phase === "processing" || it.phase === "queued"));
  const pendingKey = pending.map((it) => it.id).join(",");
  // Read by the loop at each step, so moving to "queued" slows it down
  // without restarting it.
  const fresh = useRef(false);
  useEffect(() => {
    fresh.current = pending.some((it) => it.phase === "processing");
  });

  // One loop for every pending image, restarted when that set changes (an
  // image finishing, a new one registered) and stopped when the panel
  // unmounts. Uploads and inserts already started carry on regardless.
  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(",");
    let stopped = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    const next = () => {
      t = setTimeout(() => void tick(), fresh.current ? POLL_MS : SLOW_POLL_MS);
    };
    type Row = { id: string; processing_status: string | null; processing_error: string | null };
    const ask = async (): Promise<Row[] | null> => {
      try {
        const supabase = await browserClient();
        const res = await supabase
          .from("piece_images")
          .select("id, processing_status, processing_error")
          .in("id", ids);
        return res.error || !res.data ? null : (res.data as Row[]);
      } catch {
        return null;
      }
    };
    const tick = async () => {
      const data = await ask();
      if (stopped) return;
      if (!data) {
        pollFailures.current += 1;
        if (pollFailures.current >= POLL_FAILURES_SHOWN) setPollTrouble(true);
      } else {
        pollFailures.current = 0;
        setPollTrouble(false);
        const byId = new Map(data.map((r) => [r.id, r]));
        // Worked out here, not in the state updater (which may run twice).
        const finished = ids.some((id) => byId.get(id)?.processing_status === "done");
        const now = Date.now();
        setItems((prev) =>
          prev.map((it) => {
            if (!ids.includes(it.id) || (it.phase !== "processing" && it.phase !== "queued")) return it;
            const row = byId.get(it.id);
            if (row?.processing_status === "done") return { ...it, phase: "done" };
            if (row?.processing_status === "error")
              return { ...it, phase: "error", error: row.processing_error ?? "Processing failed" };
            if (it.phase === "processing" && it.registeredAt && now - it.registeredAt > SLOW_AFTER_MS)
              return { ...it, phase: "queued" };
            return it;
          }),
        );
        // One refresh per poll that saw any image finish, not one per image.
        if (finished) router.refresh();
      }
      next();
    };
    next();
    return () => {
      stopped = true;
      if (t) clearTimeout(t);
    };
  }, [pendingKey, router]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const base = nextSortOrder + items.length;
    // The role as it is at the drop, for every file of this drop.
    const dropRole = role;
    Array.from(files).forEach((file, i) => void uploadOne(file, base + i, dropRole));
  }

  const active = items.some((it) => it.phase === "uploading" || it.phase === "processing");
  const label: Record<Phase, string> = {
    uploading: "Uploading",
    processing: "Processing…",
    queued: "Still processing",
    done: "Ready",
    error: "Failed",
  };

  return (
    <Panel>
      <div className="mb-3 flex max-w-[220px] flex-col gap-1">
        <label htmlFor={`image-role-${pieceId}`} className="label">
          Role
        </label>
        <select
          id={`image-role-${pieceId}`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="field"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleWord(r)}
            </option>
          ))}
        </select>
      </div>

      <Dropzone onFiles={handleFiles} accept="image/*,.tif,.tiff,.heic,.heif" multiple capture="environment">
        <p className="text-[13px] font-medium text-ink">Drag images here, or click to choose</p>
        <p className="mt-1 text-[12px] text-meta">
          Add several at once; each is filed as “{roleWord(role)}”. On a phone, the picker can shoot
          stock directly.
        </p>
      </Dropzone>

      {items.length > 0 ? (
        <ul className="mt-3">
          {items.map((it) => (
            <li key={it.id} className="border-t border-rule py-2 first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] text-body">
                  {it.name}
                  {/* What it is filed as, while it uploads and after. */}
                  <span className="text-meta"> · {roleWord(it.role)}</span>
                </span>
                <span
                  className={`tabular shrink-0 text-[12px] ${
                    it.phase === "error" ? "text-danger" : it.phase === "done" ? "text-ok" : "text-meta"
                  }`}
                >
                  {it.phase === "uploading" ? `Uploading ${Math.round(it.progress * 100)}%` : label[it.phase]}
                </span>
              </div>
              {it.phase === "uploading" || it.phase === "processing" ? (
                // Progress: the one place besides place and focus where the
                // accent is used (spec R1).
                <div className="mt-1.5 h-1 w-full overflow-hidden bg-rule">
                  <div
                    className="h-full bg-accent transition-[width] duration-200"
                    style={{ width: it.phase === "processing" ? "100%" : `${Math.round(it.progress * 90)}%` }}
                  />
                </div>
              ) : null}
              {it.phase === "queued" ? (
                <p className="mt-1 text-[12px] leading-[1.4] text-meta">
                  Still processing: it will appear below when ready.
                </p>
              ) : null}
              {it.phase === "error" && it.error ? (
                <p role="alert" className="mt-1 text-[12px] text-danger">
                  {it.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pollTrouble && pendingKey ? (
        <p role="status" className="mt-2 text-[12px] leading-[1.4] text-danger">
          Can’t check progress just now. The images are uploaded; reload the page later to see them.
        </p>
      ) : null}

      <p className="mt-2 text-[12px] leading-[1.4] text-meta">
        High-resolution originals (TIFF, JPEG or HEIC up to 500 MB) go to secure storage; web-size
        previews are generated automatically within a minute.
        {active ? " Keep this tab open until each image reads “Ready”." : ""}
      </p>
    </Panel>
  );
}

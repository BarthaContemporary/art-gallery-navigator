"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";

const ROLES = ["front", "back", "side", "signature", "box", "detail", "condition", "document", "other"];

type Phase = "uploading" | "processing" | "done" | "error";
type Item = { id: string; name: string; phase: Phase; progress: number; error?: string };

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
  const roleRef = useRef(role);
  roleRef.current = role;
  const router = useRouter();

  const patch = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  async function uploadOne(file: File, sort: number) {
    const supabase = createClient();
    const imageId = crypto.randomUUID();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${pieceId}/${imageId}.${ext}`;

    setItems((prev) => [...prev, { id: imageId, name: file.name, phase: "uploading", progress: 0 }]);

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
    //    was dropped in migration 0048). The VPS worker picks it up from here.
    patch(imageId, { phase: "processing", progress: 1 });
    const { error: insErr } = await supabase.from("piece_images").insert({
      id: imageId,
      piece_id: pieceId,
      role: roleRef.current,
      sort_order: sort,
      storage_path_original: path,
      file_size_bytes: file.size,
      processing_status: "pending",
    });
    if (insErr) {
      patch(imageId, { phase: "error", error: insErr.message });
      return;
    }

    // 4. Poll until the worker finishes (typically within ~a minute).
    const startedAt = Date.now();
    while (Date.now() - startedAt < 180_000) {
      await new Promise((r) => setTimeout(r, 2500));
      const { data } = await supabase
        .from("piece_images")
        .select("processing_status, processing_error")
        .eq("id", imageId)
        .maybeSingle();
      if (data?.processing_status === "done") {
        patch(imageId, { phase: "done" });
        router.refresh();
        return;
      }
      if (data?.processing_status === "error") {
        patch(imageId, { phase: "error", error: data.processing_error ?? "Processing failed" });
        return;
      }
    }
    // Timed out waiting — the worker may still catch up; show it as queued.
    router.refresh();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const base = nextSortOrder + items.length;
    Array.from(files).forEach((file, i) => void uploadOne(file, base + i));
  }

  const active = items.some((it) => it.phase === "uploading" || it.phase === "processing");
  const label: Record<Phase, string> = {
    uploading: "Uploading",
    processing: "Processing…",
    done: "Ready ✓",
    error: "Failed",
  };

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
          aria-label="Image role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <Dropzone onFiles={handleFiles} accept="image/*,.tif,.tiff,.heic,.heif" multiple capture="environment">
        <p className="text-[13px] font-medium text-ink-body">Drag images here, or click to choose</p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          Add several at once — each is filed as “{role}”. Use the picker on a phone to shoot stock
          directly.
        </p>
      </Dropzone>

      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-line-soft bg-band/40 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[12px] text-ink-body">{it.name}</span>
                <span
                  className={`shrink-0 text-[11px] ${
                    it.phase === "error"
                      ? "text-oranje"
                      : it.phase === "done"
                        ? "text-status-green"
                        : "text-ink-soft"
                  }`}
                >
                  {it.phase === "uploading" ? `Uploading ${Math.round(it.progress * 100)}%` : label[it.phase]}
                </span>
              </div>
              {it.phase === "uploading" || it.phase === "processing" ? (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line-soft">
                  <div
                    className={`h-full rounded-full bg-oranje transition-[width] duration-200 ${
                      it.phase === "processing" ? "animate-pulse" : ""
                    }`}
                    style={{ width: it.phase === "processing" ? "100%" : `${Math.round(it.progress * 90)}%` }}
                  />
                </div>
              ) : null}
              {it.phase === "error" && it.error ? (
                <p className="mt-1 text-[11px] text-oranje">{it.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[11.5px] text-ink-soft">
        High-resolution originals (TIFF/JPEG/HEIC up to 500 MB) go to secure storage; web-size
        previews are generated automatically within a minute.
        {active ? " Keep this tab open until each image reads “Ready”." : ""}
      </p>
    </div>
  );
}

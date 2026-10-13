"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";
import { Panel } from "@/components/ui/section";

const ROLES = ["front", "back", "side", "signature", "box", "detail", "condition", "document", "other"];
// The stored role, as a word.
const roleWord = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

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
                <span className="truncate text-[13px] text-body">{it.name}</span>
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
              {it.phase === "error" && it.error ? (
                <p role="alert" className="mt-1 text-[12px] text-danger">
                  {it.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[12px] leading-[1.4] text-meta">
        High-resolution originals (TIFF, JPEG or HEIC up to 500 MB) go to secure storage; web-size
        previews are generated automatically within a minute.
        {active ? " Keep this tab open until each image reads “Ready”." : ""}
      </p>
    </Panel>
  );
}

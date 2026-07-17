"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";

const ROLES = ["front", "back", "side", "signature", "box", "detail", "condition", "document", "other"];

/**
 * Uploads originals straight to the private `piece-originals` bucket, then
 * registers a pending piece_images row for the VPS image worker to process.
 * `capture` lets phones shoot stock photos directly at fairs.
 */
export function ImageUploader({ pieceId, nextSortOrder }: { pieceId: string; nextSortOrder: number }) {
  const [role, setRole] = useState("front");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const supabase = createClient();
    let sort = nextSortOrder;
    for (const file of Array.from(files)) {
      setBusy(file.name);
      const imageId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${pieceId}/${imageId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("piece-originals")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        break;
      }
      const { error: insErr } = await supabase.from("piece_images").insert({
        id: imageId,
        piece_id: pieceId,
        role,
        sort_order: sort++,
        storage_path_original: path,
        bytes: file.size,
        processing_status: "pending",
      });
      if (insErr) {
        setError(`${file.name}: ${insErr.message}`);
        break;
      }
    }
    setBusy(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Role
        </label>
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
      <Dropzone
        onFiles={handleFiles}
        accept="image/*,.tif,.tiff"
        multiple
        capture="environment"
        disabled={Boolean(busy)}
      >
        <p className="text-[13px] font-medium text-ink-body">
          {busy ? `Uploading ${busy}…` : "Drag images here, or click to choose"}
        </p>
        <p className="mt-1 text-[11.5px] text-ink-soft">
          Add several at once — each is filed as “{role}”. Use the picker on a phone to
          shoot stock directly.
        </p>
      </Dropzone>
      {error ? <p className="mt-2 text-[12px] text-ink-body">Upload failed — {error}</p> : null}
      <p className="mt-2 text-[11.5px] text-ink-soft">
        High-resolution originals (TIFF/JPEG up to 500 MB) go to secure storage; web-size
        previews are generated automatically within a minute.
      </p>
    </div>
  );
}

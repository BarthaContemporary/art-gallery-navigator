"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";

const ROLES = ["front", "back", "side", "signature", "box", "detail", "condition", "document"];

/**
 * Uploads originals straight to the private `piece-originals` bucket, then
 * registers a pending piece_images row for the VPS image worker to process.
 * `capture` lets phones shoot stock photos directly at fairs.
 */
export function ImageUploader({ pieceId, nextSortOrder }: { pieceId: string; nextSortOrder: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.tif,.tiff"
          multiple
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="text-[12.5px] text-ink-mid file:mr-3 file:rounded-lg file:border file:border-line-control file:bg-control file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium file:text-ink-mid"
        />
      </div>
      {busy ? <p className="mt-2 text-[12px] text-ink-soft">Uploading {busy}…</p> : null}
      {error ? <p className="mt-2 text-[12px] text-ink-body">Upload failed — {error}</p> : null}
      <p className="mt-2 text-[11.5px] text-ink-soft">
        High-resolution originals (TIFF/JPEG up to 500 MB) go to secure storage; web-size
        previews are generated automatically within a minute.
      </p>
    </div>
  );
}

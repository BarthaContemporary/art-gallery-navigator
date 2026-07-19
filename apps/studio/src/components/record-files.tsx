"use client";

import { useState } from "react";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";

export type RecordFile = { id: string; title: string; storage_path: string };

/**
 * Files attached to a shared record (a shipment or a document). Uploads to the
 * private `piece-documents` bucket under `<prefix>/<recordId>/…` and inserts a
 * row into `table` referencing the record via `fkColumn`.
 */
export function RecordFiles({
  table,
  fkColumn,
  recordId,
  prefix,
  initial,
}: {
  table: string;
  fkColumn: string;
  recordId: string;
  prefix: string;
  initial: RecordFile[];
}) {
  const [files, setFiles] = useState<RecordFile[]>(initial);
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stage(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setStaged((p) => [...p, ...Array.from(list)]);
  }

  async function upload() {
    if (!staged.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const remaining = [...staged];
    for (const file of staged) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const id = crypto.randomUUID();
      const path = `${prefix}/${recordId}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("piece-documents")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(upErr.message);
        setStaged(remaining);
        setBusy(false);
        return;
      }
      const row = { id, [fkColumn]: recordId, title: file.name, storage_path: path };
      const { error: insErr } = await supabase.from(table).insert(row);
      if (insErr) {
        setError(insErr.message);
        setStaged(remaining);
        setBusy(false);
        return;
      }
      setFiles((f) => [{ id, title: file.name, storage_path: path }, ...f]);
      remaining.shift();
    }
    setStaged([]);
    setBusy(false);
  }

  async function download(f: RecordFile) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("piece-documents")
      .createSignedUrl(f.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(f: RecordFile) {
    const supabase = createClient();
    await supabase.storage.from("piece-documents").remove([f.storage_path]);
    await supabase.from(table).delete().eq("id", f.id);
    setFiles((x) => x.filter((y) => y.id !== f.id));
  }

  return (
    <div>
      <ul className="divide-y divide-line-soft">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-ink-body">{f.title}</span>
            <button type="button" onClick={() => download(f)} className="text-[12px] font-medium text-[var(--jvb-ink-desc)]">
              Download
            </button>
            <button type="button" onClick={() => remove(f)} className="text-[11px] text-ink-soft underline">
              Remove
            </button>
          </li>
        ))}
        {files.length === 0 ? (
          <li className="py-2 text-[12.5px] text-ink-soft">No files yet.</li>
        ) : null}
      </ul>

      <div className="mt-3">
        <Dropzone onFiles={stage} accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic" multiple disabled={busy}>
          <p className="text-[13px] font-medium text-ink-body">Drag files here, or click to choose</p>
        </Dropzone>
      </div>
      {staged.length ? (
        <ul className="mt-2 space-y-1.5">
          {staged.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-line-soft bg-band/40 px-3 py-1.5 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-ink-body">{f.name}</span>
              <button type="button" onClick={() => setStaged((p) => p.filter((_, idx) => idx !== i))} disabled={busy} className="shrink-0 text-ink-soft hover:text-oranje">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={upload}
        disabled={busy || !staged.length}
        className="mt-3 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
      >
        {busy ? "Uploading…" : staged.length ? `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}` : "Upload"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-ink-body">Upload failed — {error}</p> : null}
    </div>
  );
}

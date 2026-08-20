"use client";

import { useState } from "react";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";
import { uploadDocument, type UploadScope } from "@/lib/upload-signed";

export type RecordFile = { id: string; title: string; storage_path: string };

/** Which table holds the rows for each scope this component serves. */
const TABLE: Partial<Record<UploadScope, string>> = {
  shipment: "shipment_documents",
};

/**
 * Files attached to a shared record (a shipment). Uploads run through the
 * signed-URL flow in lib/upload-signed.ts, so they work whenever autosave
 * works — independent of the browser client's access token.
 */
export function RecordFiles({
  scope,
  recordId,
  initial,
}: {
  scope: UploadScope;
  recordId: string;
  initial: RecordFile[];
}) {
  const table = TABLE[scope] ?? "shipment_documents";
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
    // Signed-URL flow (lib/upload-signed.ts): sign and commit ride the session
    // cookie like autosave; the file PUT itself carries no token at all. The
    // browser client's access token — whose intermittent death used to kill
    // these uploads — is no longer involved.
    const remaining = [...staged];
    for (const file of staged) {
      try {
        const doc = await uploadDocument(scope, recordId, file);
        setFiles((f) => [doc, ...f]);
        remaining.shift();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(`${file.name}: ${msg}`);
        setStaged(remaining);
        setBusy(false);
        return;
      }
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
    setError(null);
    // Row first, selected back: an RLS-filtered delete returns no error and
    // removes nothing, and the old order destroyed the file before checking.
    const { data, error: delErr } = await supabase
      .from(table)
      .delete()
      .eq("id", f.id)
      .select("id");
    if (delErr) return setError(`${f.title}: ${delErr.message}`);
    if (!data?.length)
      return setError(`${f.title}: wasn’t removed — reload the page and try again.`);
    await supabase.storage.from("piece-documents").remove([f.storage_path]);
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

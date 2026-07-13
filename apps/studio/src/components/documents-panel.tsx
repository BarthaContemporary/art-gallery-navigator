"use client";

import { useRef, useState } from "react";
import { createClient } from "@jvb/db/browser";

type Doc = {
  id: string;
  doc_type: string;
  title: string;
  storage_path: string;
  created_at: string;
};

const DOC_TYPES = [
  "purchase_invoice",
  "sale_invoice",
  "certificate",
  "export_licence",
  "condition_report",
  "provenance_document",
  "correspondence",
  "shipping",
  "insurance",
  "other",
];

/**
 * Documents attached to a piece — list + upload, self-contained so uploading
 * does not disturb unsaved edits in the piece form. Files live in the private
 * `piece-documents` bucket; invoice types are RLS-restricted to admin/accountant.
 */
export function DocumentsPanel({
  pieceId,
  initial,
}: {
  pieceId: string;
  initial: Doc[];
}) {
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [docType, setDocType] = useState("certificate");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const id = crypto.randomUUID();
    const path = `${pieceId}/${id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("piece-documents")
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) return fail(upErr.message);
    const row = {
      id,
      piece_id: pieceId,
      doc_type: docType,
      title: title.trim() || file.name,
      storage_path: path,
    };
    const { error: insErr } = await supabase.from("piece_documents").insert(row);
    if (insErr) return fail(insErr.message);
    setDocs((d) => [{ ...row, created_at: new Date().toISOString() }, ...d]);
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
  }

  function fail(msg: string) {
    setError(msg);
    setBusy(false);
  }

  async function download(doc: Doc) {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("piece-documents")
      .createSignedUrl(doc.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(doc: Doc) {
    const supabase = createClient();
    await supabase.storage.from("piece-documents").remove([doc.storage_path]);
    await supabase.from("piece_documents").delete().eq("id", doc.id);
    setDocs((d) => d.filter((x) => x.id !== doc.id));
  }

  return (
    <section className="rounded-[11px] border border-line bg-cell p-5">
      <h2 className="text-[13px] font-semibold text-ink-strong">Documents</h2>

      <ul className="mt-3 divide-y divide-line-soft">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 py-2">
            <span className="rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-ink-mid">
              {d.doc_type.replace(/_/g, " ")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-body">{d.title}</span>
            <button type="button" onClick={() => download(d)} className="text-[12px] font-medium text-[var(--jvb-ink-desc)]">
              Download
            </button>
            <button type="button" onClick={() => remove(d)} className="text-[11px] text-ink-soft underline">
              Remove
            </button>
          </li>
        ))}
        {docs.length === 0 ? (
          <li className="py-2 text-[12.5px] text-ink-soft">No documents attached yet.</li>
        ) : null}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="min-w-0 flex-1 rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
        />
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic"
          className="text-[12px] text-ink-mid file:mr-2 file:rounded-lg file:border file:border-line-control file:bg-control file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-ink-mid"
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy}
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[12px] text-ink-body">Upload failed — {error}</p> : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@jvb/db/browser";
import { Dropzone } from "@/components/dropzone";
import { uploadDocument } from "@/lib/upload-signed";

type Doc = {
  id: string;
  doc_type: string;
  title: string;
  storage_path: string;
  created_at: string;
};

// Piece-specific document types only. Documents that can span several works
// (invoices, provenance, correspondence, shipping, insurance) live in the
// shared Documents area; import/export paperwork lives on the shipment.
const DOC_TYPES = ["certificate", "condition_report", "export_licence", "other"];

const docLabel = (t: string) => t.replace(/_/g, " ");

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
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [docType, setDocType] = useState("certificate");
  const [title, setTitle] = useState("");
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stage(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setStaged((prev) => [...prev, ...Array.from(files)]);
  }
  function unstage(i: number) {
    setStaged((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function upload() {
    if (staged.length === 0) return;
    setBusy(true);
    setError(null);
    // Signed-URL flow (lib/upload-signed.ts): the file PUT carries no token,
    // and the row is written by a cookie-authed route — same auth path as
    // autosave, so a dying browser session can no longer fail these uploads.
    // The document_pieces link comes from the trigger on piece_documents
    // (migration 0065).
    const remaining = [...staged];
    for (const file of staged) {
      try {
        const doc = await uploadDocument("piece", pieceId, file, {
          docType,
          // A single title only makes sense for a single file; otherwise keep
          // each file's own name so a batch stays legible.
          title: staged.length === 1 && title.trim() ? title.trim() : undefined,
        });
        setDocs((d) => [
          { id: doc.id, doc_type: docType, title: doc.title, storage_path: doc.storage_path, created_at: new Date().toISOString() },
          ...d,
        ]);
        remaining.shift();
      } catch (e) {
        // Files before the failure did save — drop the stale router cache so
        // lists elsewhere show them.
        if (remaining.length < staged.length) router.refresh();
        return fail(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`, remaining);
      }
    }
    setTitle("");
    setStaged([]);
    setBusy(false);
    // Re-render server data and purge the client router cache, so navigating
    // back to any list (documents, shipments) shows the new counts.
    router.refresh();
  }

  function fail(msg: string, remaining: File[]) {
    setError(`Upload failed — ${msg}`);
    setStaged(remaining);
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
    setError(null);
    // Drop the row first. A delete the session isn't permitted to make is
    // filtered out by RLS rather than rejected — no error, no rows removed —
    // so ask for the row back and only then bin the file and the list entry.
    // Doing it the other way round could destroy the file while the record
    // stayed behind, pointing at nothing.
    const { data, error: delErr } = await supabase
      .from("piece_documents")
      .delete()
      .eq("id", doc.id)
      .select("id");
    if (delErr) return setError(delErr.message);
    if (!data?.length)
      return setError("That document wasn’t removed — you may not have permission.");
    // document_pieces cascades from piece_documents, so the link goes with it.
    await supabase.storage.from("piece-documents").remove([doc.storage_path]);
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    router.refresh();
  }

  return (
    <section className="rounded-[11px] border border-line bg-cell p-5">
      <h2 className="text-[13px] font-semibold text-ink-strong">Piece documents</h2>
      <p className="mt-0.5 text-[12px] text-ink-muted">
        Certificates, condition reports and other item-specific files. Invoices, provenance,
        shipping, insurance and correspondence live in{" "}
        <a href="/documents" className="text-oranje hover:underline">Documents</a>; import/export
        paperwork lives on the shipment.
      </p>

      <ul className="mt-3 divide-y divide-line-soft">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 py-2">
            <span className="rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-ink-mid">
              {docLabel(d.doc_type)}
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

      <div className="mt-4 border-t border-line-soft pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {docLabel(t)}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={staged.length > 1 ? "Title (used only for a single file)" : "Title (optional)"}
            className="min-w-0 flex-1 rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
          />
        </div>

        <div className="mt-3">
          <Dropzone
            onFiles={stage}
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic"
            multiple
            disabled={busy}
          >
            <p className="text-[13px] font-medium text-ink-body">
              Drag files here, or click to choose
            </p>
            <p className="mt-1 text-[11.5px] text-ink-soft">
              PDF, image or Word — all filed as “{docLabel(docType)}”.
            </p>
          </Dropzone>
        </div>

        {staged.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {staged.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-line-soft bg-band/40 px-3 py-1.5 text-[12.5px]"
              >
                <span className="min-w-0 flex-1 truncate text-ink-body">{f.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-soft">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => unstage(i)}
                  disabled={busy}
                  aria-label={`Remove ${f.name}`}
                  className="shrink-0 text-ink-soft hover:text-oranje"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={upload}
          disabled={busy || staged.length === 0}
          className="mt-3 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
        >
          {busy
            ? "Uploading…"
            : staged.length > 0
              ? `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}`
              : "Upload"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

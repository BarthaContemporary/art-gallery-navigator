"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/dropzone";
import { FilePreviewLink } from "@/components/file-preview";
import { DOCUMENTS_BUCKET, signDocumentUrl } from "@/lib/document-files";
import { uploadDocument } from "@/lib/upload-signed";
import { DOC_TYPE_LABELS, labelOf } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { CloseIcon, DownloadIcon } from "@/components/ui/icons";

// The browser Supabase client is loaded when it is first needed (an upload,
// a delete, a signed link), not with the page: it is about 70 kB of the
// first-load JavaScript of the record, editor, images and shipment pages.
const browserClient = () => import("@jvb/db/browser").then((m) => m.createClient());

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

const docLabel = (t: string) => labelOf(DOC_TYPE_LABELS, t);

/**
 * Documents attached to a piece: list and upload, self-contained so uploading
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
    setError(`Upload failed: ${msg}`);
    setStaged(remaining);
    setBusy(false);
  }

  async function download(doc: Doc) {
    try {
      window.open(await signDocumentUrl(doc.storage_path, 300), "_blank");
    } catch {
      setError(`${doc.title}: could not open. Reload the page and try again.`);
    }
  }

  async function remove(doc: Doc) {
    const supabase = await browserClient();
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
      return setError("That document wasn’t removed. You may not have permission.");
    // document_pieces cascades from piece_documents, so the link goes with it.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    router.refresh();
  }

  return (
    <Section
      title="Piece documents"
      meta={
        <>
          Certificates, condition reports and other item-specific files. Invoices, provenance,
          shipping, insurance and correspondence live in{" "}
          <a href="/documents" className="link">Documents</a>; import and export paperwork lives on
          the shipment.
        </>
      }
    >
      <ul>
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 border-t border-rule py-2 first:border-t-0 first:pt-0">
            <Badge size="xs" className="shrink-0">
              {docLabel(d.doc_type)}
            </Badge>
            <FilePreviewLink
              storagePath={d.storage_path}
              title={d.title}
              className="link-plain min-w-0 flex-1 truncate text-left text-[13px] text-ink"
            >
              {d.title}
            </FilePreviewLink>
            <Button variant="quiet" size="sm" icon={<DownloadIcon size={14} />} onClick={() => download(d)}>
              Download
            </Button>
            {/* A row's destructive action, as on the shipment page: quiet, in the danger colour. */}
            <Button variant="quiet" size="sm" onClick={() => remove(d)} className="text-danger">
              Remove
            </Button>
          </li>
        ))}
        {docs.length === 0 ? (
          <li className="text-[13px] text-meta">No documents attached yet.</li>
        ) : null}
      </ul>

      <div className="mt-4 border-t border-rule pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="flex flex-col gap-1">
            <label htmlFor={`doc-type-${pieceId}`} className="label">
              Document type
            </label>
            <select
              id={`doc-type-${pieceId}`}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="field"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {docLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`doc-title-${pieceId}`} className="label">
              {staged.length > 1 ? "Title (used only for a single file)" : "Title (optional)"}
            </label>
            <input
              id={`doc-title-${pieceId}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </div>
        </div>

        <div className="mt-3">
          <Dropzone
            onFiles={stage}
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic"
            multiple
            disabled={busy}
          >
            <p className="text-[13px] font-medium text-ink">
              Drag files here, or click to choose
            </p>
            <p className="mt-1 text-[12px] text-meta">
              PDF, image or Word, all filed as “{docLabel(docType)}”.
            </p>
          </Dropzone>
        </div>

        {staged.length > 0 ? (
          <ul className="mt-3">
            {staged.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 border-t border-rule py-1.5 text-[13px] first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate text-body">{f.name}</span>
                <span className="tabular shrink-0 text-[12px] text-meta">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  iconOnly
                  label={`Remove ${f.name}`}
                  onClick={() => unstage(i)}
                  disabled={busy}
                >
                  <CloseIcon size={14} />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <Button
          variant="primary"
          onClick={upload}
          disabled={staged.length === 0}
          pending={busy}
          pendingLabel="Uploading…"
          className="mt-3"
        >
          {staged.length > 0 ? `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}` : "Upload"}
        </Button>
      </div>
      {error ? (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      ) : null}
    </Section>
  );
}

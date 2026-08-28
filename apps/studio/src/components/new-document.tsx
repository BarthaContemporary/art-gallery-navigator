"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/dropzone";
import { uploadDocument } from "@/lib/upload-signed";

const DOC_TYPES: [string, string][] = [
  ["purchase_invoice", "Purchase invoice"],
  ["sale_invoice", "Sale invoice"],
  ["provenance_document", "Provenance document"],
  ["correspondence", "Correspondence"],
  ["shipping", "Shipping document"],
  ["insurance", "Insurance document"],
  ["certificate", "Certificate"],
  ["condition_report", "Condition report"],
  ["export_licence", "Export licence"],
  ["other", "Other"],
];

/**
 * Create a shared document: upload one file, set its type / date / reference,
 * then land on its page to attach inventory items. Not tied to any one piece.
 */
export function NewDocument() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("purchase_invoice");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [docDate, setDocDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
  const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

  async function create() {
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    // Signed-URL flow — see lib/upload-signed.ts. The row insert still runs
    // under the user's own RLS, so staff remain unable to file invoices.
    try {
      const doc = await uploadDocument("document", null, file, {
        title: title.trim() || undefined,
        docType,
        reference: reference.trim() || undefined,
        docDate: docDate || undefined,
      });
      // Purge the router cache before navigating, so the documents list (and
      // any other cached list) refetches with the new row when revisited.
      router.refresh();
      router.push(`/documents/${doc.id}`);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Upload failed");
    }
  }

  function fail(msg: string) {
    setError(msg);
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
      >
        New document
      </button>
    );
  }

  return (
    <div className="w-full rounded-[11px] border border-line bg-cell p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Type
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={field}>
            {DOC_TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Date
          <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Title (optional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
      </div>
      <div className="mt-3">
        <Dropzone onFiles={(l) => setFile(l?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic" disabled={busy}>
          <p className="text-[13px] font-medium text-ink-body">
            {file ? file.name : "Drag the file here, or click to choose"}
          </p>
        </Dropzone>
      </div>
      {error ? <p className="mt-2 text-[12px] text-ink-body">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={create} disabled={busy} className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50">
          {busy ? "Creating…" : "Create & attach items"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-medium text-ink-mid">
          Cancel
        </button>
      </div>
    </div>
  );
}

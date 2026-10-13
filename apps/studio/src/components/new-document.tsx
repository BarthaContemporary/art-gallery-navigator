"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/dropzone";
import { uploadDocument } from "@/lib/upload-signed";
import { DOC_TYPE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { PlusIcon } from "@/components/ui/icons";

// The shared words, with the same ten choices as before: this upload picker
// has never offered "Import documents" (import paperwork is filed on the
// shipment), and it still does not.
const DOC_TYPES = Object.entries(DOC_TYPE_LABELS).filter(([v]) => v !== "import_document");

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

  const field = "field";
  const label = "label mb-1";

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
      <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setOpen(true)}>
        New document
      </Button>
    );
  }

  return (
    <Panel title="New document" className="w-full">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="newdoc-type" className={label}>
            Type
          </label>
          <select id="newdoc-type" value={docType} onChange={(e) => setDocType(e.target.value)} className={field}>
            {DOC_TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="newdoc-reference" className={label}>
            Reference
          </label>
          <input id="newdoc-reference" value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="newdoc-date" className={label}>
            Date
          </label>
          <input id="newdoc-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="newdoc-title" className={label}>
            Title <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <input id="newdoc-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </div>
      </div>
      <div className="mt-3">
        <Dropzone onFiles={(l) => setFile(l?.[0] ?? null)} accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic" disabled={busy}>
          <p className="text-[13px] font-medium text-ink">
            {file ? file.name : "Drag the file here, or click to choose"}
          </p>
        </Dropzone>
      </div>
      {error ? (
        <Notice tone="danger" inline className="mt-2">
          {error}
        </Notice>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={create} pending={busy} pendingLabel="Creating…">
          Create and attach items
        </Button>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Panel>
  );
}

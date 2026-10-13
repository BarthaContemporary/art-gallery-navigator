"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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

/*
 * Create a shared document: upload one file, set its type / date / reference,
 * then land on its page to attach inventory items. Not tied to any one piece.
 *
 * The page's one primary action sits at the right of its PageHeader (spec
 * section 5) and the form opens below the header, so the two halves share
 * their open state through NewDocumentScope (NewDocument, below, keeps both
 * in one place for the library page):
 *
 *   <NewDocumentScope>
 *     <PageHeader actions={<NewDocumentTrigger />}>
 *       …intro…
 *       <NewDocumentPanel />
 *     </PageHeader>
 *     …the list…
 *   </NewDocumentScope>
 */

type Scope = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};
const NewDocumentContext = createContext<Scope | null>(null);
const PANEL_ID = "new-document-panel";

function useScope(): Scope {
  const scope = useContext(NewDocumentContext);
  if (!scope) throw new Error("NewDocumentTrigger and NewDocumentPanel need a NewDocumentScope around them.");
  return scope;
}

export function NewDocumentScope({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return <NewDocumentContext.Provider value={{ open, setOpen, triggerRef }}>{children}</NewDocumentContext.Provider>;
}

/** The header button. Hidden while the form is open, which has its own Cancel. */
export function NewDocumentTrigger() {
  const { open, setOpen, triggerRef } = useScope();
  return (
    <Button
      ref={triggerRef}
      variant="primary"
      icon={<PlusIcon size={14} />}
      aria-expanded={open}
      aria-controls={open ? PANEL_ID : undefined}
      onClick={() => setOpen(true)}
      className={open ? "hidden" : undefined}
    >
      New document
    </Button>
  );
}

/**
 * The button and the form in one place, the form replacing the button while
 * open (the library page's Documents panel).
 */
export function NewDocument() {
  return (
    <NewDocumentScope>
      <NewDocumentTrigger />
      <NewDocumentPanel />
    </NewDocumentScope>
  );
}

export function NewDocumentPanel() {
  const { open } = useScope();
  return open ? <NewDocumentForm /> : null;
}

function NewDocumentForm() {
  const router = useRouter();
  const { setOpen, triggerRef } = useScope();
  const typeRef = useRef<HTMLSelectElement>(null);
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

  // Opening moves focus into the form; Cancel hands it back to the header
  // button, which shows again.
  useEffect(() => {
    typeRef.current?.focus();
  }, []);
  function cancel() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div id={PANEL_ID}>
      <Panel title="New document" className="w-full">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="newdoc-type" className={label}>
              Type
            </label>
            <select ref={typeRef} id="newdoc-type" value={docType} onChange={(e) => setDocType(e.target.value)} className={field}>
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
          <Button onClick={cancel}>Cancel</Button>
        </div>
      </Panel>
    </div>
  );
}

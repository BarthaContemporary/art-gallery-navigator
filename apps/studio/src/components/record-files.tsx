"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/dropzone";
import { FilePreviewLink } from "@/components/file-preview";
import { DOCUMENTS_BUCKET, signDocumentUrl } from "@/lib/document-files";
import { uploadDocument, type UploadScope } from "@/lib/upload-signed";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { CloseIcon, DownloadIcon, UploadIcon } from "@/components/ui/icons";

// The browser Supabase client is loaded when it is first needed (an upload,
// a delete, a signed link), not with the page: it is about 70 kB of the
// first-load JavaScript of the record, editor, images and shipment pages.
const browserClient = () => import("@jvb/db/browser").then((m) => m.createClient());

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
  const router = useRouter();
  const table = TABLE[scope] ?? "shipment_documents";
  const [files, setFiles] = useState<RecordFile[]>(initial);
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  // The file being removed, for its button's pending state.
  const [removing, setRemoving] = useState<string | null>(null);
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
    let uploadedAny = false;
    for (const file of staged) {
      try {
        const doc = await uploadDocument(scope, recordId, file);
        setFiles((f) => [doc, ...f]);
        remaining.shift();
        uploadedAny = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "the upload failed";
        setError(`Couldn’t upload ${file.name}: ${msg}`);
        setStaged(remaining);
        setBusy(false);
        // Files before the failure did save — the cache must not hide them.
        if (uploadedAny) router.refresh();
        return;
      }
    }
    setStaged([]);
    setBusy(false);
    // Re-render server data and drop the client router cache, so navigating
    // back to the shipments list shows the new file count instead of the
    // cached page from before the upload.
    router.refresh();
  }

  async function download(f: RecordFile) {
    try {
      window.open(await signDocumentUrl(f.storage_path, 300), "_blank");
    } catch {
      setError(`Couldn’t open ${f.title}. Reload the page and try again.`);
    }
  }

  async function remove(f: RecordFile) {
    const supabase = await browserClient();
    setError(null);
    setRemoving(f.id);
    try {
      // Row first, selected back: an RLS-filtered delete returns no error and
      // removes nothing, and the old order destroyed the file before checking.
      const { data, error: delErr } = await supabase
        .from(table)
        .delete()
        .eq("id", f.id)
        .select("id");
      if (delErr) return setError(`Couldn’t remove ${f.title}: ${delErr.message}`);
      if (!data?.length) return setError(`${f.title} wasn’t removed. Reload the page and try again.`);
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([f.storage_path]);
      setFiles((x) => x.filter((y) => y.id !== f.id));
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <ul>
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border-t border-rule py-2 first:border-t-0 first:pt-0">
            <FilePreviewLink
              storagePath={f.storage_path}
              title={f.title}
              className="link-plain min-w-0 flex-1 truncate text-left text-[13px] text-ink"
            >
              {f.title}
            </FilePreviewLink>
            <Button variant="quiet" size="sm" icon={<DownloadIcon size={14} />} onClick={() => download(f)}>
              Download
            </Button>
            {/* Removes the file for good; a row action, so quiet in the danger
                colour. No confirm step, as before (F7 waits for the owner). */}
            <Button
              variant="quiet"
              size="sm"
              onClick={() => remove(f)}
              pending={removing === f.id}
              pendingLabel="Removing…"
              disabled={removing !== null && removing !== f.id}
              className="text-danger"
            >
              Remove
            </Button>
          </li>
        ))}
        {files.length === 0 ? <li className="text-[13px] text-body">No files yet.</li> : null}
      </ul>

      <div className="mt-4 border-t border-rule pt-4">
        <Dropzone onFiles={stage} accept=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,.heic" multiple disabled={busy}>
          <p className="text-[13px] font-medium text-ink">Drag files here, or click to choose</p>
          <p className="mt-1 text-[12px] text-meta">PDF, image or Word.</p>
        </Dropzone>
      </div>
      {staged.length ? (
        <ul className="mt-3">
          {staged.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 border-t border-rule py-1.5 text-[13px] first:border-t-0"
            >
              <span className="min-w-0 flex-1 truncate text-body">{f.name}</span>
              <span className="tabular shrink-0 text-[12px] text-meta">{(f.size / 1024).toFixed(0)} KB</span>
              <Button
                variant="quiet"
                size="sm"
                iconOnly
                label={`Remove ${f.name}`}
                onClick={() => setStaged((p) => p.filter((_, idx) => idx !== i))}
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
        icon={<UploadIcon size={14} />}
        onClick={upload}
        disabled={!staged.length}
        pending={busy}
        pendingLabel="Uploading…"
        className="mt-3"
      >
        {staged.length ? `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}` : "Upload"}
      </Button>
      {error ? (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}

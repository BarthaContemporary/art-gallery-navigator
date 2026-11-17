import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { FilePreviewLink } from "@/components/file-preview";
import { loadPieceSummaries } from "@/lib/piece-store";
import { DOC_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatCount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, buttonClass } from "@/components/ui/button";
import { DownloadIcon, EyeIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashNotice } from "@/components/ui/notice";

export const metadata = { title: "Document" };

// The shared field look on native elements: the update action reads these
// names straight from the form.
const field = "field";
const labelCls = "label mb-1";

// The same eleven values in the same order as before; the words are the
// shared ones, so this select matches the Documents filters.
const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

/** The types the row policies keep to admin (write) and the accountant (read). */
const INVOICE_TYPES = new Set(["purchase_invoice", "sale_invoice"]);

const NOT_YOURS = "Your role can read this document but not change it. Nothing was saved.";

/** A refused write in plain words; 42501 is a row policy saying no. */
function explainWrite(error: { code?: string; message: string }, invoice: boolean): string {
  if (error.code === "42501") {
    return invoice
      ? "Only an admin can file a document as an invoice. Nothing was saved."
      : "Your role cannot change this document. Nothing was saved.";
  }
  return `Could not save: ${error.message}`;
}

/** Back to the document with a message for FlashNotice. */
const errorUrl = (id: string, msg: string) => `/documents/${id}?error=${encodeURIComponent(msg)}`;

type PieceLite = { id: string; stock_number: string | null; title: string | null };

export default async function DocumentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string; error?: string }>;
}) {
  const { id } = await params;
  const { add, error: flashError } = await searchParams;
  const supabase = await getSupabase();

  const { data: doc } = await supabase
    .from("piece_documents")
    .select("id, doc_type, title, reference, doc_date, notes, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: linkData } = await supabase
    .from("document_pieces")
    .select("piece_id")
    .eq("document_id", id);
  const attachedSummaries = await loadPieceSummaries(
    supabase,
    ((linkData ?? []) as { piece_id: string }[]).map((r) => r.piece_id),
  );
  const attached = ((linkData ?? []) as { piece_id: string }[])
    .map((r) => attachedSummaries.get(r.piece_id))
    .filter(Boolean) as unknown as PieceLite[];
  const attachedIds = new Set(attached.map((p) => p.id));

  const addQ = (add ?? "").trim();
  let results: PieceLite[] = [];
  if (addQ) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    results = ((hits ?? []) as PieceLite[]).filter((h) => !attachedIds.has(h.id)).slice(0, 20);
  }

  // Invoices are filed by admin only (staff may not write them, the
  // accountant writes nothing), so only an admin is offered those types. The
  // row policy is the gate; this only spares staff a refused save.
  const session = await getSession();
  const roles = session?.roles ?? [];
  const docTypes =
    hasRole(roles, "admin") || INVOICE_TYPES.has(doc.doc_type)
      ? DOC_TYPES
      : DOC_TYPES.filter(([v]) => !INVOICE_TYPES.has(v));

  async function updateDoc(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const d = String(formData.get("doc_type") ?? "other");
    const date = String(formData.get("doc_date") ?? "").trim();
    const { data, error } = await db
      .from("piece_documents")
      .update({
        doc_type: d,
        title: String(formData.get("title") ?? "").trim() || null,
        reference: String(formData.get("reference") ?? "").trim() || null,
        doc_date: date || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .eq("id", id)
      .select("id");
    revalidatePath(`/documents/${id}`);
    if (error) redirect(errorUrl(id, explainWrite(error, INVOICE_TYPES.has(d))));
    // No row back: the policies let this account read the document but not
    // change it (the accountant), so nothing was saved.
    if (!data?.length) redirect(errorUrl(id, NOT_YOURS));
  }

  async function addPiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    const { error } = await db.from("document_pieces").upsert(
      { document_id: id, piece_id: pieceId },
      { onConflict: "document_id,piece_id", ignoreDuplicates: true },
    );
    revalidatePath(`/documents/${id}`);
    if (error) redirect(errorUrl(id, explainWrite(error, false)));
  }

  async function removePiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { error } = await db
      .from("document_pieces")
      .delete()
      .eq("document_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/documents/${id}`);
    if (error) redirect(errorUrl(id, explainWrite(error, false)));
  }

  async function deleteDoc() {
    "use server";
    const db = await getSupabase();
    // The row first, and the file only once the row is gone: the other order
    // destroyed the file before knowing whether the row could be deleted, and
    // a refused delete (the accountant) still landed on the list as if done.
    const { data, error } = await db.from("piece_documents").delete().eq("id", id).select("id");
    if (error) redirect(errorUrl(id, explainWrite(error, false)));
    if (!data?.length) redirect(errorUrl(id, NOT_YOURS));
    if (doc!.storage_path) {
      const { error: fileError } = await db.storage.from("piece-documents").remove([doc!.storage_path]);
      // The record is gone either way; a file left behind only takes space.
      if (fileError) console.error(`[documents] ${id}: file not removed: ${fileError.message}`);
    }
    revalidatePath("/documents");
    redirect("/documents");
  }

  const dateValue = doc.doc_date ? new Date(doc.doc_date).toISOString().slice(0, 10) : "";

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/documents", label: "All documents" }}
        title={labelOf(DOC_TYPE_LABELS, doc.doc_type)}
        meta={
          <span className="tabular">
            {[doc.title, doc.doc_date ? formatDate(doc.doc_date) : null, doc.reference].filter(Boolean).join(" · ") ||
              "No details yet"}
          </span>
        }
        actions={
          <>
            {doc.storage_path ? (
              <FilePreviewLink
                storagePath={doc.storage_path}
                title={doc.title ?? "Document"}
                className={buttonClass({})}
              >
                <EyeIcon size={14} />
                Preview
              </FilePreviewLink>
            ) : null}
            {doc.storage_path ? (
              // Signed when clicked (api/documents/[id]/download), so the
              // link still works after the tab has been open for a while.
              <a href={`/api/documents/${id}/download`} target="_blank" rel="noopener" className={buttonClass({})}>
                <DownloadIcon size={14} />
                Download file
              </a>
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        <FlashNotice searchParams={{ error: flashError }} />

        <Section title="Details">
          <form action={updateDoc} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="doc-type" className={labelCls}>
                Type
              </label>
              <select id="doc-type" name="doc_type" defaultValue={doc.doc_type} className={field}>
                {docTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="doc-reference" className={labelCls}>
                Reference
              </label>
              <input id="doc-reference" name="reference" defaultValue={doc.reference ?? ""} className={field} />
            </div>
            <div>
              <label htmlFor="doc-date" className={labelCls}>
                Date
              </label>
              <input id="doc-date" type="date" name="doc_date" defaultValue={dateValue} className={field} />
            </div>
            <div>
              <label htmlFor="doc-title" className={labelCls}>
                Title
              </label>
              <input id="doc-title" name="title" defaultValue={doc.title ?? ""} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="doc-notes" className={labelCls}>
                Notes
              </label>
              <textarea id="doc-notes" name="notes" rows={2} defaultValue={doc.notes ?? ""} className={field} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary" pendingLabel="Saving…">
                Save details
              </Button>
            </div>
          </form>
        </Section>

        <Section
          title="Inventory items"
          meta={<span className="tabular">{`${formatCount(attached.length)} linked`}</span>}
        >
          {attached.length > 0 ? (
            <ul className="border-t border-rule">
              {attached.map((p) => (
                <li key={p.id} className="border-b border-rule">
                  <form action={removePiece} className="flex items-center justify-between gap-3 py-2">
                    <input type="hidden" name="piece_id" value={p.id} />
                    <Link
                      href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                      className="link-plain min-w-0 text-[13px] text-ink"
                    >
                      <span className="tabular text-body">{p.stock_number ?? "—"}</span> {p.title ?? "Untitled"}
                    </Link>
                    <Button type="submit" size="sm" variant="quiet">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact>No items linked yet. Find them below.</EmptyState>
          )}

          <form method="get" className="mt-4 flex max-w-[34rem] flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="doc-add" className="label">
                Link works
              </label>
              <input
                id="doc-add"
                type="search"
                name="add"
                defaultValue={addQ}
                placeholder="Stock no., title or maker"
                className="field"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          {addQ ? (
            <div className="mt-2">
              {results.length > 0 ? (
                <ul className="border-t border-rule">
                  {results.map((w) => (
                    <li key={w.id} className="border-b border-rule">
                      <form action={addPiece} className="flex items-center justify-between gap-3 py-2">
                        <input type="hidden" name="piece_id" value={w.id} />
                        <span className="min-w-0 text-[13px] text-ink">
                          <span className="tabular text-body">{w.stock_number ?? "—"}</span> {w.title ?? "Untitled"}
                        </span>
                        <Button type="submit" size="sm">
                          Link
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-body">No works match &ldquo;{addQ}&rdquo;.</p>
              )}
            </div>
          ) : null}
        </Section>

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-strong pt-3">
          <p className="text-[13px] text-ink">Delete this document</p>
          <DeleteListButton action={deleteDoc} id={id} name="document" standalone />
        </section>
      </div>
    </div>
  );
}

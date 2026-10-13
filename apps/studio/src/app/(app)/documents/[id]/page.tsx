import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { FilePreviewLink } from "@/components/file-preview";
import { loadPieceSummaries } from "@/lib/piece-store";
import { DOC_TYPE_LABELS, labelOf } from "@/lib/labels";
import { formatCount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, buttonClass } from "@/components/ui/button";
import { DownloadIcon, EyeIcon } from "@/components/ui/icons";

export const metadata = { title: "Document" };

// The shared field look on native elements: the update action reads these
// names straight from the form.
const field = "field";
const labelCls = "label mb-1";

// The same eleven values in the same order as before; the words are the
// shared ones, so this select matches the Documents filters.
const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

type PieceLite = { id: string; stock_number: string | null; title: string | null };

export default async function DocumentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { id } = await params;
  const { add } = await searchParams;
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

  let fileUrl: string | null = null;
  if (doc.storage_path) {
    const { data } = await supabase.storage.from("piece-documents").createSignedUrl(doc.storage_path, 300);
    fileUrl = data?.signedUrl ?? null;
  }

  async function updateDoc(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const d = String(formData.get("doc_date") ?? "").trim();
    await db
      .from("piece_documents")
      .update({
        doc_type: String(formData.get("doc_type") ?? "other"),
        title: String(formData.get("title") ?? "").trim() || null,
        reference: String(formData.get("reference") ?? "").trim() || null,
        doc_date: d || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .eq("id", id);
    revalidatePath(`/documents/${id}`);
  }

  async function addPiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    await db.from("document_pieces").upsert(
      { document_id: id, piece_id: pieceId },
      { onConflict: "document_id,piece_id", ignoreDuplicates: true },
    );
    revalidatePath(`/documents/${id}`);
  }

  async function removePiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("document_pieces")
      .delete()
      .eq("document_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/documents/${id}`);
  }

  async function deleteDoc() {
    "use server";
    const db = await getSupabase();
    if (doc!.storage_path) await db.storage.from("piece-documents").remove([doc!.storage_path]);
    await db.from("piece_documents").delete().eq("id", id);
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
            {fileUrl ? (
              <a href={fileUrl} target="_blank" className={buttonClass({})}>
                <DownloadIcon size={14} />
                Download file
              </a>
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        <Section title="Details">
          <form action={updateDoc} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="doc-type" className={labelCls}>
                Type
              </label>
              <select id="doc-type" name="doc_type" defaultValue={doc.doc_type} className={field}>
                {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
            <p className="text-[13px] text-body">No items linked yet. Find them below.</p>
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
          <DeleteListButton action={deleteDoc} id={id} name="document" />
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { FilePreviewLink } from "@/components/file-preview";
import { loadPieceSummaries } from "@/lib/piece-store";

export const metadata = { title: "Document" };

const field = "mt-1 block w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const btnGhost = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

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
  ["import_document", "Import documents"],
  ["other", "Other"],
];

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
    <div className="max-w-[900px]">
      <Link href="/documents" className="text-[12.5px] text-ink-soft">← All documents</Link>
      <h1 className="mt-2 text-[22px] font-semibold text-ink-strong">
        {DOC_TYPES.find(([v]) => v === doc.doc_type)?.[1] ?? doc.doc_type.replace(/_/g, " ")}
      </h1>

      <form action={updateDoc} className="mt-5 grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-2">
        <label className={labelCls}>
          Type
          <select name="doc_type" defaultValue={doc.doc_type} className={field}>
            {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Reference
          <input name="reference" defaultValue={doc.reference ?? ""} className={field} />
        </label>
        <label className={labelCls}>
          Date
          <input type="date" name="doc_date" defaultValue={dateValue} className={field} />
        </label>
        <label className={labelCls}>
          Title
          <input name="title" defaultValue={doc.title ?? ""} className={field} />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={2} defaultValue={doc.notes ?? ""} className={field} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">Save details</button>
          {doc.storage_path ? (
            <FilePreviewLink
              storagePath={doc.storage_path}
              title={doc.title ?? "Document"}
              className="text-[12.5px] font-medium text-[var(--jvb-ink-desc)] hover:underline"
            >
              Preview
            </FilePreviewLink>
          ) : null}
          {fileUrl ? (
            <a href={fileUrl} target="_blank" className="text-[12.5px] font-medium text-[var(--jvb-ink-desc)]">
              Download file →
            </a>
          ) : null}
        </div>
      </form>

      <section className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Inventory items ({attached.length})</h2>
        <div className="mt-3 space-y-1.5">
          {attached.map((p) => (
            <form key={p.id} action={removePiece} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
              <input type="hidden" name="piece_id" value={p.id} />
              <Link href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`} className="text-[13px] text-ink-body">
                <span className="font-mono text-[12px] text-ink-muted">{p.stock_number ?? "—"}</span> {p.title ?? "Untitled"}
              </Link>
              <button className="text-[12px] text-ink-soft hover:text-ink-strong">Remove</button>
            </form>
          ))}
          {attached.length === 0 ? <p className="text-[12.5px] text-ink-muted">No items linked yet.</p> : null}
        </div>

        <form method="get" className="mt-4 flex items-center gap-2">
          <input type="search" name="add" defaultValue={addQ} placeholder="Search works to link — stock no., title, maker…" className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]" />
          <button className={btnGhost}>Search</button>
        </form>
        {addQ ? (
          <div className="mt-2 space-y-1">
            {results.map((w) => (
              <form key={w.id} action={addPiece} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
                <input type="hidden" name="piece_id" value={w.id} />
                <span className="text-[13px] text-ink-body">
                  <span className="font-mono text-[12px] text-ink-muted">{w.stock_number ?? "—"}</span> {w.title ?? "Untitled"}
                </span>
                <button className={btnGhost}>Link</button>
              </form>
            ))}
            {results.length === 0 ? <p className="text-[12.5px] text-ink-muted">No matches.</p> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-8 flex items-center justify-between rounded-[11px] border border-line-soft bg-band px-4 py-3">
        <p className="text-[13px] text-ink-strong">Delete this document</p>
        <DeleteListButton action={deleteDoc} id={id} name="document" />
      </div>
    </div>
  );
}

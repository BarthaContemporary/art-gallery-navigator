import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { RecordFiles, type RecordFile } from "@/components/record-files";
import { DeleteListButton } from "@/components/delete-list-button";

export const metadata = { title: "Shipment" };

const field = "mt-1 block w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const btnGhost = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

type PieceLite = { id: string; stock_number: string | null; title: string | null };

export default async function ShipmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { id } = await params;
  const { add } = await searchParams;
  const supabase = await getSupabase();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, kind, shipment_date, reference, notes")
    .eq("id", id)
    .maybeSingle();
  if (!shipment) notFound();

  const [{ data: filesData }, { data: linkData }] = await Promise.all([
    supabase.from("shipment_documents").select("id, title, storage_path").eq("shipment_id", id).order("created_at"),
    supabase
      .from("piece_shipments")
      .select("piece:pieces ( id, stock_number, title )")
      .eq("shipment_id", id),
  ]);
  const files = (filesData ?? []) as RecordFile[];
  const attached = ((linkData ?? []) as unknown as { piece: PieceLite | null }[])
    .map((r) => r.piece)
    .filter((p): p is PieceLite => Boolean(p));
  const attachedIds = new Set(attached.map((p) => p.id));

  const addQ = (add ?? "").trim();
  let results: PieceLite[] = [];
  if (addQ) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    results = ((hits ?? []) as PieceLite[]).filter((h) => !attachedIds.has(h.id)).slice(0, 20);
  }

  async function updateShipment(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const date = String(formData.get("shipment_date") ?? "").trim();
    await db
      .from("shipments")
      .update({
        shipment_date: date || null,
        reference: String(formData.get("reference") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .eq("id", id);
    revalidatePath(`/shipments/${id}`);
  }

  async function addPiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    // One import + one export per piece — re-assign if it's already on another.
    await db
      .from("piece_shipments")
      .upsert(
        { piece_id: pieceId, shipment_id: id, kind: shipment!.kind },
        { onConflict: "piece_id,kind" },
      );
    revalidatePath(`/shipments/${id}`);
  }

  async function removePiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("piece_shipments")
      .delete()
      .eq("shipment_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/shipments/${id}`);
  }

  async function deleteShipment() {
    "use server";
    const db = await getSupabase();
    await db.from("shipments").delete().eq("id", id);
    redirect("/shipments");
  }

  const dateValue = shipment.shipment_date
    ? new Date(shipment.shipment_date).toISOString().slice(0, 10)
    : "";

  return (
    <div className="max-w-[900px]">
      <Link href="/shipments" className="text-[12.5px] text-ink-soft">
        ← All shipments
      </Link>
      <h1 className="mt-2 text-[22px] font-semibold capitalize text-ink-strong">
        {shipment.kind} shipment
      </h1>

      {/* Settings */}
      <form action={updateShipment} className="mt-5 grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-2">
        <label className={labelCls}>
          {shipment.kind === "export" ? "Export date" : "Import date"}
          <input type="date" name="shipment_date" defaultValue={dateValue} className={field} />
        </label>
        <label className={labelCls}>
          Reference number
          <input name="reference" defaultValue={shipment.reference ?? ""} className={field} />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={2} defaultValue={shipment.notes ?? ""} className={field} />
        </label>
        <div className="sm:col-span-2">
          <button className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
            Save details
          </button>
        </div>
      </form>

      {/* Files */}
      <section className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Documents</h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Upload the {shipment.kind} paperwork once here — it applies to every item below.
        </p>
        <div className="mt-3">
          <RecordFiles table="shipment_documents" fkColumn="shipment_id" recordId={id} prefix="shipments" initial={files} />
        </div>
      </section>

      {/* Attached items */}
      <section className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">
          Inventory items ({attached.length})
        </h2>
        <div className="mt-3 space-y-1.5">
          {attached.map((p) => (
            <form key={p.id} action={removePiece} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
              <input type="hidden" name="piece_id" value={p.id} />
              <Link href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`} className="text-[13px] text-ink-body">
                <span className="font-mono text-[12px] text-ink-muted">{p.stock_number ?? "—"}</span>{" "}
                {p.title ?? "Untitled"}
              </Link>
              <button className="text-[12px] text-ink-soft hover:text-ink-strong">Remove</button>
            </form>
          ))}
          {attached.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No items attached yet.</p>
          ) : null}
        </div>

        <form method="get" className="mt-4 flex items-center gap-2">
          <input
            type="search"
            name="add"
            defaultValue={addQ}
            placeholder="Search works to attach — stock no., title, maker…"
            className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
          />
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
                <button className={btnGhost}>Attach</button>
              </form>
            ))}
            {results.length === 0 ? <p className="text-[12.5px] text-ink-muted">No matches.</p> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-8 flex items-center justify-between rounded-[11px] border border-line-soft bg-band px-4 py-3">
        <p className="text-[13px] text-ink-strong">Delete this shipment</p>
        <DeleteListButton action={deleteShipment} id={id} name={`${shipment.kind} shipment`} />
      </div>
    </div>
  );
}

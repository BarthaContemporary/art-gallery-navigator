import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { RecordFiles, type RecordFile } from "@/components/record-files";
import { RecordReturn } from "@/components/record-return";
import { DeleteListButton } from "@/components/delete-list-button";
import { AutosaveForm } from "@/components/autosave-form";
import { loadPieceSummaries, type PieceSummary } from "@/lib/piece-store";
import { loadThumbnails } from "@/lib/thumbnails";
import { PieceLine } from "@/components/piece-line";

export const metadata = { title: "Shipment" };

const field = "mt-1 block w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const btnGhost = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

const KIND_LABEL: Record<string, string> = {
  import: "Import",
  temporary_import: "Temporary import",
  export: "Export",
  temporary_export: "Temporary export",
};

// The attached list and the search results below show the same four things —
// thumbnail, stock number, title with year, maker — so both run through the
// shared piece summary rather than whatever columns each query happened to
// return.
type PieceLite = PieceSummary;
type LinkRow = { piece: PieceLite | null; returned_at: string | null; closed_reason: string | null };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

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
    .select("id, kind, shipment_date, reference, notes, destination_country")
    .eq("id", id)
    .maybeSingle();
  if (!shipment) notFound();
  const isTemp = shipment.kind === "temporary_export";

  const [{ data: filesData }, { data: linkData }] = await Promise.all([
    supabase.from("shipment_documents").select("id, title, storage_path").eq("shipment_id", id).order("created_at"),
    supabase
      .from("piece_shipments")
      .select("returned_at, closed_reason, piece_id")
      .eq("shipment_id", id),
  ]);
  const files = (filesData ?? []) as RecordFile[];
  const linkSummaries = await loadPieceSummaries(
    supabase,
    ((linkData ?? []) as { piece_id: string }[]).map((l) => l.piece_id),
  );
  const links = ((linkData ?? []) as unknown as (Omit<LinkRow, "piece"> & { piece_id: string })[])
    .map((l) => ({ ...l, piece: linkSummaries.get(l.piece_id) ?? null }))
    .filter((l) => l.piece) as LinkRow[];
  const attachedIds = new Set(links.map((l) => l.piece!.id));

  const addQ = (add ?? "").trim();
  let results: PieceLite[] = [];
  if (addQ) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    // pieces_search returns raw stock rows; the maker name lives on the union
    // view, so hydrate the page's worth of ids the same way the attached list
    // does rather than embedding a second shape here.
    const hitIds = ((hits ?? []) as { id: string }[])
      .map((h) => h.id)
      .filter((hid) => !attachedIds.has(hid))
      .slice(0, 20);
    const resultSummaries = await loadPieceSummaries(supabase, hitIds);
    results = hitIds
      .map((hid) => resultSummaries.get(hid))
      .filter((r): r is PieceLite => Boolean(r));
  }

  // One signing call covers the attached works and the search results together.
  const thumbs = await loadThumbnails(supabase, [
    ...links.map((l) => l.piece!.id),
    ...results.map((r) => r.id),
  ]);

  async function addPiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    if (shipment!.kind === "temporary_export" || shipment!.kind === "temporary_import") {
      // A piece may be on many temporary shipments — just add the link.
      await db
        .from("piece_shipments")
        .upsert(
          { piece_id: pieceId, shipment_id: id, kind: shipment!.kind },
          { onConflict: "piece_id,shipment_id", ignoreDuplicates: true },
        );
    } else {
      // One import / one export per piece — reassign if already on another. The
      // unique index on (piece_id, kind) is partial, so ON CONFLICT inference
      // can't target it; clear any existing link of this kind first, then add.
      await db.from("piece_shipments").delete().eq("piece_id", pieceId).eq("kind", shipment!.kind);
      await db.from("piece_shipments").insert({ piece_id: pieceId, shipment_id: id, kind: shipment!.kind });
    }
    revalidatePath(`/shipments/${id}`);
  }

  async function removePiece(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db.from("piece_shipments").delete().eq("shipment_id", id).eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/shipments/${id}`);
  }

  // Mark one item returned (or reopen it).
  async function markReturned(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    const date = String(formData.get("return_date") ?? "").trim();
    await db
      .from("piece_shipments")
      .update({ returned_at: date || null, closed_reason: null })
      .eq("shipment_id", id)
      .eq("piece_id", pieceId);
    revalidatePath(`/shipments/${id}`);
  }

  async function reopen(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("piece_shipments")
      .update({ returned_at: null, closed_reason: null })
      .eq("shipment_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/shipments/${id}`);
  }

  // Bulk return: stamp the date on every still-out item, auto-skipping any that
  // were written off or permanently exported in the meantime (they get a
  // closed_reason instead of a return date).
  async function recordReturn(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const date = String(formData.get("return_date") ?? "").trim();
    if (!date) return;
    const { data: open } = await db
      .from("piece_shipments")
      .select("piece_id")
      .eq("shipment_id", id)
      .eq("kind", "temporary_export")
      .is("returned_at", null)
      .is("closed_reason", null);
    const openSummaries = await loadPieceSummaries(
      db,
      ((open ?? []) as { piece_id: string }[]).map((r) => r.piece_id),
    );
    const rows = ((open ?? []) as { piece_id: string }[]).map((r) => ({
      piece_id: r.piece_id,
      piece: openSummaries.get(r.piece_id) ?? null,
    }));
    if (rows.length === 0) return;
    const ids = rows.map((r) => r.piece_id);

    // Which of these have a permanent export link?
    const { data: exp } = await db
      .from("piece_shipments")
      .select("piece_id")
      .eq("kind", "export")
      .in("piece_id", ids);
    const exportedIds = new Set((exp ?? []).map((r) => r.piece_id as string));

    const writtenOff: string[] = [];
    const exported: string[] = [];
    const returned: string[] = [];
    for (const r of rows) {
      if (r.piece?.status === "written_off") writtenOff.push(r.piece_id);
      else if (exportedIds.has(r.piece_id)) exported.push(r.piece_id);
      else returned.push(r.piece_id);
    }
    if (returned.length)
      await db.from("piece_shipments").update({ returned_at: date }).eq("shipment_id", id).in("piece_id", returned);
    if (writtenOff.length)
      await db.from("piece_shipments").update({ closed_reason: "written_off" }).eq("shipment_id", id).in("piece_id", writtenOff);
    if (exported.length)
      await db.from("piece_shipments").update({ closed_reason: "exported" }).eq("shipment_id", id).in("piece_id", exported);
    revalidatePath(`/shipments/${id}`);
  }

  async function deleteShipment() {
    "use server";
    const db = await getSupabase();
    await db.from("shipments").delete().eq("id", id);
    redirect("/shipments");
  }

  const dateValue = shipment.shipment_date ? new Date(shipment.shipment_date).toISOString().slice(0, 10) : "";
  const stillOut = links.filter((l) => !l.returned_at && !l.closed_reason).length;

  return (
    <div className="max-w-[900px]">
      <Link href="/shipments" className="text-[12.5px] text-ink-soft">← All shipments</Link>
      <h1 className="mt-2 text-[22px] font-semibold text-ink-strong">{KIND_LABEL[shipment.kind]}</h1>

      <AutosaveForm endpoint={`/api/shipments/${id}`} className="mt-5">
        <div className="grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-2">
          <label className={labelCls}>
            {`${KIND_LABEL[shipment.kind] ?? "Shipment"} date`}
            <input type="date" name="shipment_date" defaultValue={dateValue} className={field} />
          </label>
          <label className={labelCls}>
            Reference number
            <input name="reference" defaultValue={shipment.reference ?? ""} className={field} />
          </label>
          {shipment.kind === "export" || shipment.kind === "temporary_export" ? (
            <label className={`${labelCls} sm:col-span-2`}>
              Destination country
              <input
                name="destination_country"
                defaultValue={shipment.destination_country ?? ""}
                placeholder="e.g. United States, Japan, France"
                className={field}
              />
            </label>
          ) : null}
          <label className={`${labelCls} sm:col-span-2`}>
            Notes
            <textarea name="notes" rows={2} defaultValue={shipment.notes ?? ""} className={field} />
          </label>
        </div>
      </AutosaveForm>

      <section className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Documents</h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Upload the paperwork once here — it applies to every item below.
        </p>
        <div className="mt-3">
          <RecordFiles table="shipment_documents" fkColumn="shipment_id" recordId={id} prefix="shipments" initial={files} />
        </div>
      </section>

      {/* Bulk return (temporary exports only) */}
      {isTemp && stillOut > 0 ? (
        <section className="mt-6 rounded-[11px] border border-oranje/30 bg-oranje/5 p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Record return</h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Pick a date and preview which of the {stillOut} item{stillOut === 1 ? "" : "s"} still
            out will be returned before confirming.
          </p>
          <div className="mt-3">
            <RecordReturn shipmentId={id} action={recordReturn} />
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Inventory items ({links.length})</h2>
        <div className="mt-3 space-y-1.5">
          {links.map((l) => {
            const p = l.piece!;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2">
                <Link href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`} className="min-w-0">
                  <PieceLine
                    stockNumber={p.stock_number}
                    title={p.title}
                    year={p.year}
                    makerName={p.maker_name}
                    thumbUrl={thumbs.get(p.id)}
                  />
                </Link>
                <div className="flex items-center gap-3">
                  {isTemp ? (
                    l.returned_at ? (
                      <span className="text-[11.5px] text-status-green">Returned {fmtDate(l.returned_at)}</span>
                    ) : l.closed_reason ? (
                      <span className="text-[11.5px] text-ink-soft">Not returned · {l.closed_reason.replace(/_/g, " ")}</span>
                    ) : (
                      <form action={markReturned} className="flex items-center gap-1">
                        <input type="hidden" name="piece_id" value={p.id} />
                        <input type="date" name="return_date" required className="rounded-md border border-line-control bg-control px-2 py-1 text-[11.5px]" />
                        <button className="text-[11.5px] font-medium text-[var(--jvb-ink-desc)]">Returned</button>
                      </form>
                    )
                  ) : null}
                  {isTemp && (l.returned_at || l.closed_reason) ? (
                    <form action={reopen}>
                      <input type="hidden" name="piece_id" value={p.id} />
                      <button className="text-[11.5px] text-ink-soft hover:text-ink-strong">Reopen</button>
                    </form>
                  ) : null}
                  <form action={removePiece}>
                    <input type="hidden" name="piece_id" value={p.id} />
                    <button className="text-[12px] text-ink-soft hover:text-ink-strong">Remove</button>
                  </form>
                </div>
              </div>
            );
          })}
          {links.length === 0 ? <p className="text-[12.5px] text-ink-muted">No items attached yet.</p> : null}
        </div>

        <form method="get" className="mt-4 flex items-center gap-2">
          <input type="search" name="add" defaultValue={addQ} placeholder="Search works to attach — stock no., title, maker…" className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]" />
          <button className={btnGhost}>Search</button>
        </form>
        {addQ ? (
          <div className="mt-2 space-y-1">
            {results.map((w) => (
              <form key={w.id} action={addPiece} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2">
                <input type="hidden" name="piece_id" value={w.id} />
                <PieceLine
                  stockNumber={w.stock_number}
                  title={w.title}
                  year={w.year}
                  makerName={w.maker_name}
                  thumbUrl={thumbs.get(w.id)}
                />
                <button className={btnGhost}>Attach</button>
              </form>
            ))}
            {results.length === 0 ? <p className="text-[12.5px] text-ink-muted">No matches.</p> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-8 flex items-center justify-between rounded-[11px] border border-line-soft bg-band px-4 py-3">
        <p className="text-[13px] text-ink-strong">Delete this shipment</p>
        <DeleteListButton action={deleteShipment} id={id} name={(KIND_LABEL[shipment.kind] ?? shipment.kind).toLowerCase()} />
      </div>
    </div>
  );
}

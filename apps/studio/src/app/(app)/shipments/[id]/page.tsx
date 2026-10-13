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
import { formatCount, formatDate } from "@/lib/format";
import { SHIPMENT_KIND_LABELS as KIND_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Shipment" };

// The shared field look on native elements, so the autosave form posts
// exactly the names it always did (CLAUDE.md autosave rule).
const field = "field";
const labelCls = "label mb-1";

// The attached list and the search results below show the same four things —
// thumbnail, stock number, title with year, maker — so both run through the
// shared piece summary rather than whatever columns each query happened to
// return.
type PieceLite = PieceSummary;
type LinkRow = { piece: PieceLite | null; returned_at: string | null; closed_reason: string | null };

const fmtDate = (d: string | null) => formatDate(d, "short");

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

  const kindLabel = KIND_LABEL[shipment.kind] ?? "Shipment";

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/shipments", label: "All shipments" }}
        title={kindLabel}
        meta={
          <span className="tabular">
            {[
              shipment.shipment_date ? formatDate(shipment.shipment_date) : "No date yet",
              shipment.reference,
              `${formatCount(links.length)} ${links.length === 1 ? "item" : "items"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        }
      />

      <div className="space-y-6">
        <Section title="Details">
          <AutosaveForm endpoint={`/api/shipments/${id}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sh-date" className={labelCls}>{`${kindLabel} date`}</label>
                <input id="sh-date" type="date" name="shipment_date" defaultValue={dateValue} className={field} />
              </div>
              <div>
                <label htmlFor="sh-reference" className={labelCls}>
                  Reference number
                </label>
                <input id="sh-reference" name="reference" defaultValue={shipment.reference ?? ""} className={field} />
              </div>
              {shipment.kind === "export" || shipment.kind === "temporary_export" ? (
                <div className="sm:col-span-2">
                  <label htmlFor="sh-destination" className={labelCls}>
                    Destination country
                  </label>
                  <input
                    id="sh-destination"
                    name="destination_country"
                    defaultValue={shipment.destination_country ?? ""}
                    placeholder="e.g. United States, Japan, France"
                    className={field}
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label htmlFor="sh-notes" className={labelCls}>
                  Notes
                </label>
                <textarea id="sh-notes" name="notes" rows={2} defaultValue={shipment.notes ?? ""} className={field} />
              </div>
            </div>
          </AutosaveForm>
        </Section>

        <Section title="Documents" meta="Upload the paperwork once here. It applies to every item below.">
          <RecordFiles scope="shipment" recordId={id} initial={files} />
        </Section>

        {/* Bulk return (temporary exports only) */}
        {isTemp && stillOut > 0 ? (
          <Section
            title="Record return"
            meta={`Pick a date and preview which of the ${stillOut} item${stillOut === 1 ? "" : "s"} still out will be returned before confirming.`}
          >
            <RecordReturn shipmentId={id} action={recordReturn} />
          </Section>
        ) : null}

        <Section
          title="Inventory items"
          meta={<span className="tabular">{`${formatCount(links.length)} attached`}</span>}
        >
          {links.length > 0 ? (
            <ul className="border-t border-rule">
              {links.map((l) => {
                const p = l.piece!;
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rule py-2 sm:flex-nowrap"
                  >
                    {/* flex-1 + min-w-0: a long title truncates rather than
                        pushing the row's buttons onto a line of their own. */}
                    <Link
                      href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                      className="link-plain min-w-0 flex-1"
                    >
                      <PieceLine
                        stockNumber={p.stock_number}
                        title={p.title}
                        year={p.year}
                        makerName={p.maker_name}
                        thumbUrl={thumbs.get(p.id)}
                      />
                    </Link>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {isTemp ? (
                        l.returned_at ? (
                          <Badge tone="ok" variant="dot">
                            <span className="tabular">Returned {fmtDate(l.returned_at)}</span>
                          </Badge>
                        ) : l.closed_reason ? (
                          <Badge variant="dot">Not returned · {l.closed_reason.replace(/_/g, " ")}</Badge>
                        ) : (
                          <form action={markReturned} className="flex items-center gap-1.5">
                            <input type="hidden" name="piece_id" value={p.id} />
                            <input
                              type="date"
                              name="return_date"
                              required
                              aria-label={`Return date for ${p.stock_number ?? "this work"}`}
                              className="field field-sm w-[150px]"
                            />
                            <Button type="submit" size="sm">
                              Returned
                            </Button>
                          </form>
                        )
                      ) : null}
                      {isTemp && (l.returned_at || l.closed_reason) ? (
                        <form action={reopen}>
                          <input type="hidden" name="piece_id" value={p.id} />
                          <Button type="submit" size="sm" variant="quiet">
                            Reopen
                          </Button>
                        </form>
                      ) : null}
                      <form action={removePiece}>
                        <input type="hidden" name="piece_id" value={p.id} />
                        <Button type="submit" size="sm" variant="quiet">
                          Remove
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-body">No items attached yet. Find them below.</p>
          )}

          <form method="get" className="mt-4 flex max-w-[34rem] flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="sh-add" className="label">
                Attach works
              </label>
              <input
                id="sh-add"
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
                        <span className="min-w-0 flex-1">
                          <PieceLine
                            stockNumber={w.stock_number}
                            title={w.title}
                            year={w.year}
                            makerName={w.maker_name}
                            thumbUrl={thumbs.get(w.id)}
                          />
                        </span>
                        <Button type="submit" size="sm" className="shrink-0">
                          Attach
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
          <p className="text-[13px] text-ink">Delete this shipment</p>
          <DeleteListButton
            action={deleteShipment}
            id={id}
            name={(KIND_LABEL[shipment.kind] ?? shipment.kind).toLowerCase()}
            standalone
          />
        </section>
      </div>
    </div>
  );
}

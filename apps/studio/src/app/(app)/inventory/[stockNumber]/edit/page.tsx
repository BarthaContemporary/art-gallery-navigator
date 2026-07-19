import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { PieceFormFields } from "@/components/piece-form";
import { DocumentsPanel } from "@/components/documents-panel";
import { EditHeader } from "@/components/edit-header";
import { AutosaveForm } from "@/components/autosave-form";
import { LegacyRecordPanel } from "@/components/legacy-record-panel";
import { DeleteListButton } from "@/components/delete-list-button";

export const metadata = { title: "Edit record" };

export default async function EditPiecePage({
  params,
}: {
  params: Promise<{ stockNumber: string }>;
}) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();
  const session = await getSession();
  const showFinancials = session ? canSeeFinancials(session.roles) : false;

  const { data: piece } = await supabase
    .from("pieces")
    .select("*")
    .eq("stock_number", stockNumber)
    .maybeSingle();
  if (!piece) notFound();

  const [makers, categories, locations, originRegions, financials, primaryImage, documents, imageCount] =
    await Promise.all([
      supabase.from("makers").select("id, display_name, life_dates").order("display_name"),
      supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("locations").select("id, code").order("code"),
      supabase.from("origin_regions").select("name").eq("is_active", true).order("sort_order"),
      showFinancials
        ? supabase.from("piece_financials").select("*").eq("piece_id", piece.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("piece_images")
        .select("storage_path_display")
        .eq("piece_id", piece.id)
        .not("storage_path_display", "is", null)
        .order("role", { ascending: true })
        .order("sort_order")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("document_pieces")
        .select("doc:piece_documents ( id, doc_type, title, storage_path, created_at )")
        .eq("piece_id", piece.id),
      supabase
        .from("piece_images")
        .select("id", { count: "exact", head: true })
        .eq("piece_id", piece.id),
    ]);

  // Documents linked to this piece (via the shared document_pieces link table).
  const pieceDocs = ((documents.data ?? []) as unknown as {
    doc: { id: string; doc_type: string; title: string; storage_path: string; created_at: string } | null;
  }[])
    .map((r) => r.doc)
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  // Import / export shipments: this piece's current links + options to link to.
  const [{ data: shipLinks }, { data: allShipments }] = await Promise.all([
    supabase
      .from("piece_shipments")
      .select("kind, shipment:shipments ( id, kind, shipment_date, reference )")
      .eq("piece_id", piece.id),
    supabase
      .from("shipments")
      .select("id, kind, shipment_date, reference")
      .order("shipment_date", { ascending: false, nullsFirst: false }),
  ]);
  const shipmentByKind = new Map<string, { id: string; shipment_date: string | null; reference: string | null }>();
  for (const l of (shipLinks ?? []) as unknown as {
    kind: string;
    shipment: { id: string; shipment_date: string | null; reference: string | null } | null;
  }[]) {
    if (l.shipment) shipmentByKind.set(l.kind, l.shipment);
  }
  const shipmentOptions = (allShipments ?? []) as { id: string; kind: string; shipment_date: string | null; reference: string | null }[];

  async function linkShipment(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const shipmentId = String(formData.get("shipment_id") ?? "");
    const kind = String(formData.get("kind") ?? "");
    if (!shipmentId || (kind !== "import" && kind !== "export")) return;
    await db
      .from("piece_shipments")
      .upsert({ piece_id: piece.id, shipment_id: shipmentId, kind }, { onConflict: "piece_id,kind" });
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}/edit`);
  }

  async function unlinkShipment(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const kind = String(formData.get("kind") ?? "");
    await db.from("piece_shipments").delete().eq("piece_id", piece.id).eq("kind", kind);
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}/edit`);
  }

  let buyerName: string | null = null;
  const buyerContactId = financials.data?.buyer_contact_id as string | null | undefined;
  if (buyerContactId) {
    const { data: buyer } = await supabase
      .from("crm_contacts")
      .select("first_name, last_name, email")
      .eq("id", buyerContactId)
      .maybeSingle();
    if (buyer) {
      buyerName =
        [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") ||
        buyer.email ||
        null;
    }
  }

  // Category options = active categories, plus this piece's current category
  // even if it's a hidden legacy one (so it isn't silently dropped on save).
  const categoryOptions = (categories.data ?? []).map((c) => ({ id: c.id, label: c.name }));
  const currentCatId = piece.category_id as string | null;
  if (currentCatId && !categoryOptions.some((c) => c.id === currentCatId)) {
    const { data: cur } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", currentCatId)
      .maybeSingle();
    if (cur) categoryOptions.push({ id: cur.id, label: cur.name });
  }
  const originOptions = (originRegions.data ?? []).map((o) => o.name as string);

  async function deletePiece() {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    // Soft delete: moves the record to the trash for 30 days.
    await db
      .from("pieces")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", piece.id);
    revalidatePath("/inventory");
    redirect("/inventory/trash");
  }

  let thumbUrl: string | null = null;
  if (primaryImage.data?.storage_path_display) {
    const { data } = await supabase.storage
      .from("piece-derivatives")
      .createSignedUrl(primaryImage.data.storage_path_display, 3600);
    thumbUrl = data?.signedUrl ?? null;
  }

  return (
    <div>
      <AutosaveForm endpoint={`/api/inventory/${encodeURIComponent(stockNumber)}`}>
        <EditHeader
          thumbUrl={thumbUrl}
          stockNumber={piece.stock_number}
          title={piece.title ?? null}
          legacyStock={piece.legacy_stock_number ?? null}
          legacyConflict={Boolean(piece.legacy_stock_number_conflict)}
          imageCount={imageCount.count ?? 0}
          webVisible={Boolean(piece.web_visible)}
        />
        <div className="mt-6">
          <PieceFormFields
            piece={piece}
            financials={financials.data}
            makers={(makers.data ?? []).map((m) => ({
            id: m.id,
            label: m.life_dates ? `${m.display_name} (${m.life_dates})` : m.display_name,
          }))}
            categories={categoryOptions}
            locations={(locations.data ?? []).map((l) => ({ id: l.id, label: l.code }))}
            originRegions={originOptions}
            showFinancials={showFinancials}
            buyerName={buyerName}
          />
        </div>
      </AutosaveForm>

      {/* Import / export shipments */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["import", "export"] as const).map((kind) => {
          const current = shipmentByKind.get(kind);
          const opts = shipmentOptions.filter((s) => s.kind === kind);
          return (
            <section key={kind} className="rounded-[11px] border border-line bg-cell p-5">
              <h2 className="text-[13px] font-semibold capitalize text-ink-strong">{kind} shipment</h2>
              {current ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Link href={`/shipments/${current.id}`} className="text-[13px] text-ink-body hover:text-oranje">
                    {current.shipment_date ? new Date(current.shipment_date).toLocaleDateString("en-GB") : "No date"}
                    {current.reference ? ` · ${current.reference}` : ""}
                  </Link>
                  <form action={unlinkShipment}>
                    <input type="hidden" name="kind" value={kind} />
                    <button className="text-[12px] text-ink-soft hover:text-ink-strong">Unlink</button>
                  </form>
                </div>
              ) : (
                <p className="mt-2 text-[12.5px] text-ink-muted">Not linked to an {kind}.</p>
              )}
              <form action={linkShipment} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="kind" value={kind} />
                <select name="shipment_id" defaultValue="" required className="flex-1 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body">
                  <option value="" disabled>Link to an existing {kind}…</option>
                  {opts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shipment_date ? new Date(s.shipment_date).toLocaleDateString("en-GB") : "No date"}
                      {s.reference ? ` · ${s.reference}` : ""}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid">Link</button>
              </form>
              <Link href="/shipments" className="mt-2 inline-block text-[11.5px] text-oranje hover:underline">
                Manage shipments →
              </Link>
            </section>
          );
        })}
      </div>

      <div className="mt-6">
        <DocumentsPanel pieceId={piece.id} initial={pieceDocs} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-line-soft bg-band px-4 py-3">
        <div>
          <p className="text-[13px] font-medium text-ink-strong">Delete this record</p>
          <p className="text-[12px] text-ink-soft">
            Moves it to the trash for 30 days — you can reinstate it until then.
          </p>
        </div>
        <DeleteListButton action={deletePiece} id={piece.id} name={piece.stock_number} />
      </div>

      {/* Original FileMaker record — kept at the bottom of the page */}
      {showFinancials ? (
        <div className="mt-8">
          <LegacyRecordPanel pieceId={piece.id} />
        </div>
      ) : null}
    </div>
  );
}

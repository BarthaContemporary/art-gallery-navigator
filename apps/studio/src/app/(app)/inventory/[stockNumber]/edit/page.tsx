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
        .from("piece_documents")
        .select("id, doc_type, title, storage_path, created_at")
        .eq("piece_id", piece.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("piece_images")
        .select("id", { count: "exact", head: true })
        .eq("piece_id", piece.id),
    ]);

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

      <div className="mt-6">
        <DocumentsPanel pieceId={piece.id} initial={documents.data ?? []} />
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

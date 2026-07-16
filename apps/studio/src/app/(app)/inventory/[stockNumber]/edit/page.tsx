import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { PieceFormFields } from "@/components/piece-form";
import { DocumentsPanel } from "@/components/documents-panel";
import { AiCataloguer } from "@/components/ai-cataloguer";
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
      supabase.from("makers").select("id, display_name").order("display_name"),
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
      {/* header with object image so the editor sees what they are editing */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/inventory/${encodeURIComponent(piece.stock_number)}/images`}
            className="block shrink-0"
            title="Manage images"
          >
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt={piece.title ?? "Object"} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <span className="jvb-hatch flex h-16 w-16 items-center justify-center rounded-lg text-[16px] text-ink-soft">
                ▦
              </span>
            )}
          </Link>
          <div>
            <h1 className="text-[26px] font-semibold text-ink-strong">
              Edit <span className="font-mono text-[20px]">{piece.stock_number}</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">{piece.title ?? "Untitled"}</p>
            <div className="mt-1 flex items-center gap-3 text-[12px]">
              {piece.legacy_stock_number ? (
                <span className="font-mono text-ink-soft">
                  Legacy {piece.legacy_stock_number}
                  {piece.legacy_stock_number_conflict ? " (dup)" : ""}
                </span>
              ) : null}
              <Link
                href={`/inventory/${encodeURIComponent(piece.stock_number)}/images`}
                className="font-medium text-[var(--jvb-ink-desc)]"
              >
                Manage images ({imageCount.count ?? 0}) →
              </Link>
              <Link
                href={`/inventory/${encodeURIComponent(piece.stock_number)}`}
                className="text-ink-muted"
              >
                View record
              </Link>
            </div>
          </div>
        </div>
      </div>

      <AutosaveForm
        endpoint={`/api/inventory/${encodeURIComponent(stockNumber)}`}
        className="mt-6"
      >
        <PieceFormFields
          piece={piece}
          financials={financials.data}
          makers={(makers.data ?? []).map((m) => ({ id: m.id, label: m.display_name }))}
          categories={categoryOptions}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, label: l.code }))}
          originRegions={originOptions}
          showFinancials={showFinancials}
          buyerName={buyerName}
        />
      </AutosaveForm>

      {/* AI cataloguing + documents live outside the form so they never disturb unsaved edits */}
      {showFinancials ? <LegacyRecordPanel pieceId={piece.id} /> : null}
      <AiCataloguer stockNumber={piece.stock_number} />
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
    </div>
  );
}

import { SaveToDriveLink } from "@/components/save-to-drive";
import { signedThumbnail, PREVIEW_WIDTH, THUMB_WIDTH } from "@/lib/thumbnails";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolvePiece, type PieceRef } from "@/lib/piece-store";
import { movePieceLedger } from "../actions";
import {
  getSupabase,
  requireSession,
  canSeeFinancials,
  hasRole,
} from "@/lib/supabase";
import { PieceGallery, type GalleryImage } from "@/components/piece-gallery";
import { RecordKeyNav } from "@/components/record-key-nav";
import { RecordMenu } from "@/components/record-menu";
import { StatusPill } from "@/components/status-pill";
import { RegisterBadge } from "@/components/register-badge";
import { RegisterMove } from "@/components/register-move";
import { ChangeHistory, type HistoryEntry } from "@/components/change-history";
import { FilePreviewLink } from "@/components/file-preview";
import { cmToInchesFraction } from "@/lib/measure";
import { titleWithYear } from "@jvb/db";
import { formatDimensionsCm } from "@jvb/db";
import { consignmentSplit, round2 } from "@/lib/consignment";
import { DOC_TYPE_LABELS, VAT_TREATMENT_LABELS, labelOf } from "@/lib/labels";
// London time and the shared money format; this page renders on the server,
// where a bare toLocaleString prints UTC.
import { formatCount, formatDate, formatDateTime, gbpDisplay, gbpExact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { FlashNotice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { WebsiteDot } from "@/components/ui/website-switch";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  EyeIcon,
  FileIcon,
  FlagIcon,
} from "@/components/ui/icons";

export const metadata = { title: "Piece detail" };

// The website square's kinds (pieces.presentation, piece_image_squares.kind),
// in the words of the editor's "Website square" select.
const SQUARE_WORDS: Record<string, string> = {
  flat: "flat work",
  object: "object",
  photo: "photograph as taken",
};

const ROLE_CAPTIONS: Record<string, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
  signature: "Signature",
  box: "Box",
  detail: "Detail",
  condition: "Condition",
  document: "Document",
  other: "Other",
};

// Whole pounds, as before: the record's price and margin summary. The
// accountant's figures to the penny live in the editor and the stock book.
const gbp = gbpDisplay;

export default async function PieceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ stockNumber: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();
  const { user, roles } = await requireSession();
  const showFinancials = canSeeFinancials(roles);
  const isAdmin = hasRole(roles, "admin");

  const ref = await resolvePiece(supabase, stockNumber);
  if (!ref) notFound();
  // A number retired by a register move still names this work everywhere it was
  // printed or emailed; send it to the number the record carries now.
  if (ref.retiredNumber) redirect(`/inventory/${encodeURIComponent(ref.stockNumber)}`);
  // Hoisted server actions below close over this; a non-nullable const keeps
  // the narrowing that the guard above established.
  const store: PieceRef = ref;

  const { data: piece } = await supabase
    .from(ref.table)
    .select(
      `*,
       maker:makers(id, display_name, life_dates),
       category:categories(id, name, code),
       location:locations(id, code, name)`,
    )
    .eq("id", ref.id)
    .maybeSingle();

  if (!piece) notFound();

  const [
    imagesRes,
    provenanceRes,
    watchRes,
    positionRes,
    totalRes,
    activityRes,
    financialsRes,
    relatedRes,
    historyRes,
    documentsRes,
    enquiriesRes,
    prevRes,
    nextRes,
    { data: expShipments },
    { data: flagRow },
    { data: pieceLists },
  ] = await Promise.all([
    supabase
      .from("piece_images")
      .select("id, role, caption, sort_order, storage_path_display, processing_status")
      .eq("piece_id", piece.id)
      .order("sort_order"),
    supabase
      .from("provenance_entries")
      // is_public: whether the line may appear on the website; the others
      // are marked internal here.
      .select("id, date_text, party, event_type, details, is_public")
      .eq("piece_id", piece.id)
      .order("sort_order"),
    supabase
      .from("piece_watches")
      .select("piece_id")
      .eq("piece_id", piece.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    // Record position counts within this work's own register — the two series
    // are separate, so "12 of 240" across both would mean nothing. Trashed
    // works are left out here and in prev/next below: the record page reads
    // through vw_pieces_list, so a trashed neighbour would open as a 404.
    supabase
      .from(ref.table)
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("stock_number", piece.stock_number),
    supabase.from(ref.table).select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("activity_log")
      .select(
        isAdmin
          ? "id, action, created_at, actor_id, entity_type, changes"
          : "id, action, created_at, actor_id",
      )
      .eq("entity_id", piece.id)
      .order("created_at", { ascending: false })
      .limit(isAdmin ? 200 : 6),
    showFinancials
      ? supabase
          .from("piece_financials")
          .select("*")
          .eq("piece_id", piece.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Other works by this maker, across both registers — who made a thing is
    // independent of who owns it.
    piece.maker_id
      ? supabase
          .from("vw_pieces_list")
          .select("id, stock_number, title, status, year")
          .eq("maker_id", piece.maker_id)
          .neq("id", piece.id)
          .limit(4)
      : Promise.resolve({ data: [] }),
    supabase
      .from("piece_location_history")
      .select("id, moved_at, note, from_loc:locations!piece_location_history_from_location_id_fkey(code), to_loc:locations!piece_location_history_to_location_id_fkey(code)")
      .eq("piece_id", piece.id)
      .order("moved_at", { ascending: false })
      .limit(5),
    supabase
      .from("document_pieces")
      .select("doc:piece_documents ( id, doc_type, title, storage_path, created_at )")
      .eq("piece_id", piece.id),
    supabase
      .from("enquiries")
      .select("id, created_at", { count: "exact" })
      .eq("piece_id", piece.id)
      .order("created_at", { ascending: false })
      .limit(1),
    // The queries below used to run one after another once this batch had
    // finished; none depends on another, so they ride along with it.
    // Adjacent records for prev/next (by stock number ordering).
    supabase
      .from(ref.table)
      .select("stock_number")
      .is("deleted_at", null)
      .lt("stock_number", piece.stock_number)
      .order("stock_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from(ref.table)
      .select("stock_number")
      .is("deleted_at", null)
      .gt("stock_number", piece.stock_number)
      .order("stock_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Export / temporary-export destination country (shown in the spec grid).
    supabase
      .from("piece_shipments")
      .select("kind, shipment:shipments ( shipment_date, destination_country )")
      .eq("piece_id", piece.id)
      .in("kind", ["export", "temporary_export"]),
    // Temporary flag (per user) — the record-page form of the overview's ⚑.
    supabase
      .from("piece_flags")
      .select("piece_id")
      .eq("piece_id", piece.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("piece_lists")
      .select("id, name")
      .eq("is_dynamic", false)
      .order("sort_order")
      .order("name"),
  ]);

  let exportDest: string | null = null;
  let tempExportDest: string | null = null;
  for (const r of (expShipments ?? []) as unknown as {
    kind: string;
    shipment: { destination_country: string | null } | null;
  }[]) {
    if (!r.shipment?.destination_country) continue;
    if (r.kind === "export") exportDest = r.shipment.destination_country;
    else if (r.kind === "temporary_export") tempExportDest = r.shipment.destination_country;
  }

  // Display masters run to 4096 px, so the hero is signed at PREVIEW_WIDTH and
  // the strip at THUMB_WIDTH through the storage transform; the gallery loads
  // the master itself only when someone zooms in.
  const imageRows = imagesRes.data ?? [];
  const images: GalleryImage[] = await Promise.all(
    imageRows.map(async (img) => {
      let url: string | null = null;
      let preview: string | null = null;
      let thumb: string | null = null;
      if (img.storage_path_display) {
        const path = img.storage_path_display;
        const [master, previewUrl, thumbUrl] = await Promise.all([
          supabase.storage.from("piece-derivatives").createSignedUrl(path, 3600),
          signedThumbnail(supabase, "piece-derivatives", path, PREVIEW_WIDTH),
          signedThumbnail(supabase, "piece-derivatives", path, THUMB_WIDTH),
        ]);
        url = master.data?.signedUrl ?? null;
        preview = previewUrl;
        thumb = thumbUrl;
      }
      return {
        id: img.id,
        url,
        preview,
        thumb,
        caption: img.caption || ROLE_CAPTIONS[img.role] || "Image",
      };
    }),
  );

  // Signed preview image per related work ("More from this maker" thumbnails).
  const related = (relatedRes.data ?? []) as {
    id: string;
    stock_number: string;
    title: string | null;
    status: string;
    year: number | null;
  }[];
  const relatedImg = new Map<string, string>();

  // Activity rows, read here because the actor names below need them.
  const activityRows = (activityRes.data ?? []) as unknown as Array<{
    id: number | string;
    action: string;
    created_at: string;
    actor_id: string | null;
    entity_type?: string | null;
    changes?: Record<string, unknown> | null;
  }>;
  const actorIds = isAdmin
    ? [...new Set(activityRows.map((a) => a.actor_id).filter((x): x is string => Boolean(x)))]
    : [];
  const fin = financialsRes.data;
  const buyerContactId = (fin?.buyer_contact_id as string | null | undefined) ?? null;
  // The photograph the website tile is drawn from: the first processed one.
  const firstDone = imageRows.find((im) => im.storage_path_display && im.processing_status === "done");

  // The follow-up reads each depend on the batch above but not on each
  // other, so they run together.
  const [relImgsRes, profsRes, buyerRes, squareRes] = await Promise.all([
    related.length
      ? supabase
          .from("piece_images")
          .select("piece_id, role, sort_order, storage_path_display")
          .in("piece_id", related.map((r) => r.id))
          .not("storage_path_display", "is", null)
      : Promise.resolve({ data: [] as { piece_id: string; role: string; sort_order: number | null; storage_path_display: string | null }[] }),
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    showFinancials && buyerContactId
      ? supabase.from("crm_contacts").select("id, first_name, last_name, email").eq("id", buyerContactId).maybeSingle()
      : Promise.resolve({ data: null }),
    firstDone
      ? supabase.from("piece_image_squares").select("guess, kind, square_path").eq("image_id", firstDone.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (related.length) {
    const relImgs = relImgsRes.data;
    // Best image per piece: prefer the "front" role, then lowest sort_order.
    const best = new Map<string, { score: number; sort: number; path: string }>();
    for (const im of relImgs ?? []) {
      const path = im.storage_path_display as string | null;
      if (!path) continue;
      const score = im.role === "front" ? 0 : 1;
      const sort = im.sort_order ?? 0;
      const cur = best.get(im.piece_id as string);
      if (!cur || score < cur.score || (score === cur.score && sort < cur.sort))
        best.set(im.piece_id as string, { score, sort, path });
    }
    await Promise.all(
      [...best.entries()].map(async ([pid, v]) => {
        const url = await signedThumbnail(supabase, "piece-derivatives", v.path, THUMB_WIDTH);
        if (url) relatedImg.set(pid, url);
      }),
    );
  }

  const watching = Boolean(watchRes.data);
  const flagged = Boolean(flagRow);
  const total = totalRes.count ?? 0;
  const position = total - (positionRes.count ?? 1) + 1;
  const enquiryCount = enquiriesRes.count ?? 0;
  const lastEnquiry = enquiriesRes.data?.[0]?.created_at;

  // Activity / change history. Admins get the full field-level diff with the
  // name of whoever made each change; other roles see a short recent list
  // (and RLS returns nothing to staff regardless).
  let historyEntries: HistoryEntry[] = [];
  if (isAdmin) {
    const names: Record<string, string> = Object.fromEntries(
      (profsRes.data ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]),
    );
    historyEntries = activityRows.map((a) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      actor: a.actor_id ? names[a.actor_id] ?? null : null,
      entityType: a.entity_type ?? null,
      changes: a.changes ?? null,
    }));
  }

  const daysInStock = fin?.purchase_date
    ? Math.floor(
        (Date.now() - new Date(fin.purchase_date).getTime()) / 86_400_000,
      )
    : null;
  const marginPct =
    fin?.marked_price_gbp && fin?.total_cost_gbp != null && fin.marked_price_gbp > 0
      ? (((fin.marked_price_gbp - fin.total_cost_gbp) / fin.marked_price_gbp) * 100).toFixed(1)
      : null;

  // Consignment / co-ownership status + the J.v.d.B. projected margin. The
  // "projected margin" is worked out at the marked (asking) price; when the
  // work is consigned/co-owned with a share %, it becomes J.v.d.B.'s projected
  // share instead of the overall margin.
  const num0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const consignSharePct = piece.consignment_share_pct as number | null;
  const consignSaleHandled = piece.sale_handled_by_jvb as boolean | null;
  const consignCoOwner = (piece.shares_note as string | null)?.trim() || null;
  const onConsignment =
    Boolean(fin?.consignment_id) ||
    consignSharePct != null ||
    Boolean(consignCoOwner) ||
    Boolean(piece.consignee_contact_id) ||
    consignSaleHandled != null;
  const useJvbMargin = onConsignment && consignSharePct != null && fin?.marked_price_gbp != null;
  const jvbProjectedMargin = useJvbMargin
    ? consignmentSplit({
        amount: fin!.marked_price_gbp as number,
        vatTreatment: String(fin!.vat_treatment ?? "margin_scheme"),
        saleHandledByJvb: consignSaleHandled,
        purchaseCostGbp: num0(fin!.purchase_cost_gbp),
        extraCostsGbp: num0(fin!.restoration_cost_gbp) + num0(fin!.other_costs_gbp),
        importVatPaidGbp: fin!.import_type === "import_vat_paid" ? num0(fin!.import_vat_gbp) : 0,
        sharePct: consignSharePct as number,
      }).jvbNetProfit
    : null;

  // Website state for the header. The square is what the sync draws the
  // tile from: the owner's choice, or on auto its reading of the first
  // photograph. Objects and room photographs get a rendered square; until the
  // sync has made it (or read the photograph at all) it is "pending". Only
  // said of works on the website, since the sync renders nothing else.
  const webVisible = Boolean(piece.web_visible);
  const presentation = String(piece.presentation ?? "auto");
  const square = squareRes.data as { guess: string; kind: string; square_path: string | null } | null;
  const squareKind = presentation !== "auto" ? presentation : square?.guess ?? null;
  const squarePending =
    Boolean(firstDone) &&
    (!square || (squareKind !== "flat" && (square.kind !== squareKind || !square.square_path)));
  const squareText = !webVisible || !firstDone
    ? null
    : `Square: ${squareKind ? SQUARE_WORDS[squareKind] ?? squareKind : "not read yet"}${
        presentation === "auto" && squareKind ? " (auto)" : ""
      }${squarePending ? ", pending" : ""}`;

  // The sale, for the roles that see financials: the same VAT rules as the
  // editor's Financials panel (CLAUDE.md, Money / VAT). Margin scheme: 1/6 of
  // sale less total cost, import VAT paid counting as a cost; standard: 1/6
  // of the sale; zero-rated and outside scope: none. A sale handled by a
  // third party carries no VAT for the gallery.
  const soldGbp = fin?.sold_price_gbp != null ? Number(fin.sold_price_gbp) : null;
  const hasSale = Boolean(fin && (soldGbp != null || fin.sold_date || buyerContactId));
  const saleThirdParty = consignSaleHandled === false;
  const saleTreatment = String(fin?.vat_treatment ?? "margin_scheme");
  const saleCostBase =
    num0(fin?.total_cost_gbp) +
    (saleTreatment === "margin_scheme" && fin?.import_type === "import_vat_paid" ? num0(fin?.import_vat_gbp) : 0);
  const saleVat =
    soldGbp != null && soldGbp > 0 && !saleThirdParty
      ? round2(
          saleTreatment === "margin_scheme"
            ? Math.max(0, soldGbp - saleCostBase) / 6
            : saleTreatment === "standard"
              ? soldGbp / 6
              : 0,
        )
      : 0;
  const saleNet = soldGbp != null ? round2(soldGbp - saleVat) : null;
  const saleVatBasis = saleThirdParty
    ? "No VAT: sold by a third party"
    : saleTreatment === "margin_scheme"
      ? "1/6 of the margin (sale less total cost)"
      : saleTreatment === "standard"
        ? "1/6 of the sale price"
        : "No VAT on this treatment";
  const buyer = buyerRes.data as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  const buyerName = buyer
    ? [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.email || "Unnamed contact"
    : null;
  const soldToNote = (piece.sold_to as string | null)?.trim() || null;

  const documents = ((documentsRes.data ?? []) as unknown as {
    doc: { id: string; doc_type: string; title: string | null; storage_path: string | null } | null;
  }[])
    .map((r) => r.doc)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const provenance = (provenanceRes.data ?? []) as {
    id: string;
    date_text: string | null;
    party: string | null;
    details: string | null;
    is_public: boolean | null;
  }[];

  async function addToList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const listId = String(formData.get("list_id") ?? "");
    if (!listId) return;
    // List membership keys on the identity, so which register holds the work
    // does not come into it.
    const pieceRow = { id: store.id };
    const { data: mx } = await db
      .from("piece_list_items")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    await db.from("piece_list_items").upsert(
      { list_id: listId, piece_id: pieceRow.id, sort_order: (mx?.sort_order ?? -1) + 1 },
      { onConflict: "list_id,piece_id", ignoreDuplicates: true },
    );
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}`);
  }

  // Reinstate: revert the fields touched by one change back to their prior
  // values. Admin only; the revert itself is logged as a fresh edit so the
  // audit trail is never lost.
  async function revertChange(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { roles: r } = await requireSession();
    if (!hasRole(r, "admin")) return;
    const entryId = String(formData.get("entry_id") ?? "");
    if (!entryId) return;

    const { data: entry } = await db
      .from("activity_log")
      .select("entity_type, entity_id, action, changes")
      .eq("id", entryId)
      .eq("entity_id", piece.id)
      .maybeSingle();
    if (!entry || entry.action !== "UPDATE" || !entry.changes) return;

    const IMMUTABLE = new Set([
      "id", "piece_id", "created_at", "updated_at", "created_by", "updated_by",
      "search_vector", "total_cost_gbp", "margin_gbp", "margin_pct",
      "stock_number", "deleted_at",
    ]);
    const changes = entry.changes as Record<string, { old?: unknown; new?: unknown }>;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (k === "old" || k === "new" || IMMUTABLE.has(k)) continue;
      if (v && typeof v === "object" && "old" in v) patch[k] = v.old ?? null;
    }
    if (Object.keys(patch).length === 0) return;

    if (entry.entity_type === "pieces" || entry.entity_type === "external_pieces") {
      patch.updated_by = user.id;
      // Write through the table that holds it now, not the one the entry was
      // logged against — a register move does not invalidate older history.
      await db.from(store.table).update(patch).eq("id", store.id);
    } else if (entry.entity_type === "piece_financials") {
      if (!canSeeFinancials(roles)) return;
      await db.from("piece_financials").update(patch).eq("piece_id", piece.id);
    } else {
      return;
    }
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}`);
  }

  /**
   * Hand the register move to the database function, which does the copy,
   * delete, renumber and log in one transaction and re-checks the admin role.
   */
  async function moveRegister(formData: FormData) {
    "use server";
    const to = String(formData.get("to") ?? "");
    if (to !== "jvb" && to !== "external") return;
    await movePieceLedger(store.stockNumber, to, String(formData.get("note") ?? ""));
  }

  async function toggleWatch() {
    "use server";
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const pieceRow = { id: store.id };
    const { data: existing } = await supabase
      .from("piece_watches")
      .select("piece_id")
      .eq("piece_id", pieceRow.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("piece_watches")
        .delete()
        .eq("piece_id", pieceRow.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("piece_watches")
        .insert({ piece_id: pieceRow.id, user_id: user.id });
    }
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}`);
  }

  async function toggleFlag() {
    "use server";
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from("piece_flags")
      .select("piece_id")
      .eq("piece_id", store.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("piece_flags").delete().eq("piece_id", store.id).eq("user_id", user.id);
    } else {
      await supabase.from("piece_flags").insert({ piece_id: store.id, user_id: user.id });
    }
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}`);
    revalidatePath("/inventory");
  }

  const specs: [string, React.ReactNode][] = [
    ["Category", piece.category ? `${piece.category.code} · ${piece.category.name}` : "—"],
    ["Medium", piece.medium ?? "—"],
    ["Period", piece.period ?? "—"],
    ["Origin", piece.origin_region ?? "—"],
    // For a framed work the default dimensions ARE the framed size, so the
    // label says so; the unframed work itself follows on its own line.
    [
      piece.framed ? "Dimensions (framed)" : "Dimensions",
      renderDimensions(piece),
    ],
    // The Unframed line exists only on framed works — a dash row on every
    // ceramic and bronze would be noise.
    ...(piece.framed
      ? ([
          [
            "Unframed",
            (() => {
              const unframed: Dims = {
                height_cm: piece.unframed_height_cm,
                width_cm: piece.unframed_width_cm,
                depth_cm: piece.unframed_depth_cm,
                length_cm: piece.unframed_length_cm,
                diameter_cm: piece.unframed_diameter_cm,
              };
              // Framed but the work itself not yet measured: an explicit
              // reminder rather than a dash that reads like "does not apply".
              return formatDimensionsCm(unframed)
                ? renderDimensions(unframed)
                : "Not measured";
            })(),
          ],
        ] as [string, React.ReactNode][])
      : []),
    ["Weight", piece.weight_g ? `${(piece.weight_g / 1000).toFixed(1)} kg` : "—"],
    ["Location", piece.location?.code ?? "—"],
    ["Acquired", formatDate(fin?.purchase_date, "short")],
    ["Reference", piece.legacy_stock_number ? `Legacy ${piece.legacy_stock_number}` : piece.stock_number],
    ...(exportDest ? ([["Exported to", exportDest]] as [string, React.ReactNode][]) : []),
    ...(tempExportDest ? ([["Temp. export to", tempExportDest]] as [string, React.ReactNode][]) : []),
  ];

  const sn = encodeURIComponent(piece.stock_number);
  const prevHref = prevRes.data ? `/inventory/${encodeURIComponent(prevRes.data.stock_number)}` : null;
  const nextHref = nextRes.data ? `/inventory/${encodeURIComponent(nextRes.data.stock_number)}` : null;

  return (
    // Record and detail pages sit in the wide measure (spec section 3).
    <div className="max-w-[var(--jvb-measure-wide)]">
      <FlashNotice searchParams={sp} className="mb-4" />
      <RecordKeyNav prevHref={prevHref} nextHref={nextHref} />

      {/* 1 · record bar: where you are, the way on, and the record's actions.
          Sticky from tablet width; on a phone it wraps to two rows and
          scrolls away, leaving the screen to the work. */}
      <div
        style={{ top: "var(--app-header-h, 88px)" }}
        className="z-30 -mt-2 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-[var(--jvb-header-bg)] py-2.5 backdrop-blur-[8px] md:sticky"
      >
        {/* On a phone: the trail and ‹ › on one row, the actions on the next.
            From tablet width: one row, the record's controls on the right. */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-[1.4] text-meta md:flex-none">
          <Link href="/inventory" className="inline-flex shrink-0 items-center gap-1 hover:text-ink">
            <ArrowLeftIcon size={14} />
            Inventory
          </Link>
          <span aria-hidden className="hidden text-light sm:inline">/</span>
          <span className="hidden truncate sm:inline">{piece.category?.name ?? "Uncategorised"}</span>
          <span aria-hidden className="text-light">/</span>
          <span aria-current="page" className="tabular shrink-0 text-body">
            {piece.stock_number}
          </span>
        </nav>
        <div className="flex items-center gap-2 md:ml-auto">
          <span className="hidden text-[12px] leading-[1.4] text-meta md:inline">
            <span className="tabular">{formatCount(position)}</span> of{" "}
            <span className="tabular">{formatCount(total)}</span>
          </span>
          <span className="flex items-center gap-1">
            {prevHref ? (
              <ButtonLink href={prevHref} iconOnly label="Previous record" size="sm">
                <ChevronLeftIcon />
              </ButtonLink>
            ) : null}
            {nextHref ? (
              <ButtonLink href={nextHref} iconOnly label="Next record" size="sm">
                <ChevronRightIcon />
              </ButtonLink>
            ) : null}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <span aria-hidden className="hidden h-5 w-px bg-rule md:inline-block" />
          {/* Words on a wide screen; narrower, the icon, named by aria-label. */}
          <form action={toggleWatch}>
            <Button
              type="submit"
              aria-pressed={watching}
              aria-label={watching ? "Watching" : "Watch"}
              icon={<EyeIcon size={15} />}
              className={`px-3 ${watching ? "border-ink bg-band" : ""}`}
            >
              <span className="hidden lg:inline">{watching ? "Watching" : "Watch"}</span>
            </Button>
          </form>
          <form action={toggleFlag}>
            <Button
              type="submit"
              aria-pressed={flagged}
              aria-label={flagged ? "Flagged" : "Flag"}
              title={flagged ? "Flagged. Press to remove the flag." : "Flag this work to come back to it from the inventory"}
              icon={<FlagIcon size={15} className={flagged ? "text-warn" : undefined} />}
              className={`px-3 ${flagged ? "border-warn bg-warn-wash text-warn" : ""}`}
            >
              <span className="hidden lg:inline">{flagged ? "Flagged" : "Flag"}</span>
            </Button>
          </form>
          {/* Documents ▾: the exports and the list form, one click away */}
          <RecordMenu label="Documents" icon={<FileIcon size={15} />}>
            <p className="label">Documents</p>
            <ul className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-4 text-[13px] leading-[1.45]">
              {(
                [
                  ["Fact sheet", `/api/export/fact-sheet.pdf?stock=${sn}`, `/api/export/fact-sheet.docx?stock=${sn}`],
                  ["Certificate", `/api/export/certificate.pdf?stock=${sn}`, `/api/export/certificate.docx?stock=${sn}`],
                ] as const
              ).map(([what, pdf, docx]) => (
                <li key={what} className="col-span-2 grid grid-cols-subgrid items-baseline border-b border-rule py-1.5">
                  <span className="text-body">{what}</span>
                  <span className="flex gap-3">
                    <SaveToDriveLink href={pdf} className="link">
                      PDF
                    </SaveToDriveLink>
                    <SaveToDriveLink href={docx} className="link">
                      DOCX
                    </SaveToDriveLink>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] leading-[1.4] text-meta">Saved onto the shared drive.</p>

            {/* add to list: file this work into a static list */}
            <div className="mt-4 border-t border-rule-strong pt-3">
              {pieceLists && pieceLists.length > 0 ? (
                <form action={addToList} className="flex flex-col gap-1">
                  <label htmlFor="add-to-list" className="label">
                    Add to list
                  </label>
                  <div className="flex items-center gap-2">
                    <select id="add-to-list" name="list_id" defaultValue="" required className="field">
                      <option value="" disabled>
                        Choose a list…
                      </option>
                      {pieceLists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" pendingLabel="Adding…">
                      Add
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-[13px] text-body">
                  No lists yet.{" "}
                  <Link href="/inventory/lists" className="link">
                    Create one
                  </Link>
                </p>
              )}
              <Link href="/inventory/lists" className="link mt-2 inline-block text-[12px]">
                Manage lists →
              </Link>
            </div>
          </RecordMenu>
          <ButtonLink
            href={`/inventory/${sn}/edit`}
            variant="primary"
            icon={<EditIcon size={15} />}
            className="ml-auto md:ml-0"
          >
            Edit record
          </ButtonLink>
        </div>
      </div>

      {/* 2 · the work: gallery beside its identity and facts */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div>
          <PieceGallery
            images={images}
            stockNumber={piece.stock_number}
            imagesMeta={`${images.length} image${images.length === 1 ? "" : "s"}`}
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusPill status={piece.status} />
            <RegisterBadge ledger={store.ledger} />
            <WebsiteDot on={webVisible} className="text-[12px] leading-[1.4]" />
            {squareText ? (
              <span className="text-[12px] leading-[1.4] text-meta">{squareText}</span>
            ) : null}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] leading-[1.4] text-meta">
            <span className="tabular">Stock {piece.stock_number}</span>
            {daysInStock != null ? (
              <span>
                <span className="tabular">{formatCount(daysInStock)}</span> days in stock
              </span>
            ) : null}
          </p>

          {isAdmin ? (
            <div className="mt-2">
              <RegisterMove
                action={moveRegister}
                ledger={store.ledger}
                stockNumber={piece.stock_number}
              />
            </div>
          ) : null}

          {piece.maker ? (
            <p className="mt-5 text-[13px] font-medium leading-[1.45] text-body">
              <Link href={`/makers/${piece.maker.id}`} className="link-plain">
                {piece.maker.display_name}
                {piece.maker.life_dates ? ` (${piece.maker.life_dates})` : ""}
              </Link>
            </p>
          ) : null}
          <h1 className={`${piece.maker ? "mt-1" : "mt-5"} text-display text-ink`}>
            {titleWithYear(piece.title, piece.year)}
          </h1>
          {piece.period || piece.origin_region ? (
            <p className="mt-1.5 text-[14.5px] leading-[1.45] text-body">
              {[piece.period, piece.origin_region].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {/* the facts, on hairlines */}
          <dl className="mt-6 grid grid-cols-2 border-t border-rule-strong sm:grid-cols-3 lg:grid-cols-2">
            {specs.map(([label, value]) => (
              <div key={label} className="min-w-0 border-b border-rule py-2.5 pr-3">
                <dt className="label">{label}</dt>
                <dd className="mt-1 text-[13.5px] leading-[1.5] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 space-y-6">
            {piece.description ? (
              <Section title="Description">
                <p className="max-w-[var(--jvb-measure)] whitespace-pre-line text-[16px] leading-[1.6] text-body">
                  {piece.description}
                </p>
              </Section>
            ) : null}

            {piece.condition_report || piece.signature_inscription ? (
              <div
                className={`grid grid-cols-1 gap-6 ${
                  piece.condition_report && piece.signature_inscription ? "sm:grid-cols-2" : ""
                }`}
              >
                {piece.condition_report ? (
                  <Section title="Condition">
                    <p className="text-[14.5px] leading-[1.55] text-body">{piece.condition_report}</p>
                  </Section>
                ) : null}
                {piece.signature_inscription ? (
                  <Section title="Signature">
                    <p className="text-[14.5px] leading-[1.55] text-body">{piece.signature_inscription}</p>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {provenance.length > 0 ? (
              <Section title="Provenance & history">
                <ol>
                  {provenance.map((p) => (
                    <li
                      key={p.id}
                      className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 border-t border-rule py-2.5 first:border-t-0 first:pt-0"
                    >
                      <span className="tabular text-[12px] leading-[1.6] text-meta">{p.date_text ?? "—"}</span>
                      <span className="text-[14.5px] leading-[1.5] text-body">
                        {p.party}
                        {p.is_public === false ? (
                          // Kept off the website by the sync; the tag says so here.
                          <Badge size="xs" className="ml-2" title="Not shown on the website">
                            Internal
                          </Badge>
                        ) : null}
                        {p.details ? (
                          <span className="mt-0.5 block text-[13px] leading-[1.45] text-meta">{p.details}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-8">
        {/* 3 · commercial: admin and accountant only */}
        {showFinancials && fin ? (
          <Section title="Commercial">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Stat label="Marked price">{gbp(fin.marked_price_gbp)}</Stat>
              <Stat label="Purchase cost">{gbp(fin.total_cost_gbp)}</Stat>
              <Stat
                label={useJvbMargin ? "Projected margin (JvdB)" : "Projected margin"}
                sub={useJvbMargin ? `${consignSharePct}% share` : marginPct ? `${marginPct}%` : null}
              >
                {useJvbMargin
                  ? gbp(jvbProjectedMargin)
                  : fin.marked_price_gbp != null && fin.total_cost_gbp != null
                    ? gbp(fin.marked_price_gbp - fin.total_cost_gbp)
                    : "—"}
              </Stat>
              <Stat
                label="Enquiries"
                sub={lastEnquiry ? `last ${formatDate(lastEnquiry, "short", { year: false })}` : null}
              >
                {formatCount(enquiryCount)}
              </Stat>
            </dl>
            {(() => {
              // Consignment status derives from the Consignment panel fields on
              // the piece (co-owner/consignee, share %, sale-handled), computed
              // above; a legacy consignment_id link still counts.
              const vatText = labelOf(VAT_TREATMENT_LABELS, fin.vat_treatment).toLowerCase();
              return (
                <div className="mt-5 border-t border-rule pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-semibold leading-[1.45] text-ink">
                      {onConsignment ? "Consigned" : "Owned outright"}
                    </span>
                    <Badge>{onConsignment ? "Consignment" : "Not consigned"}</Badge>
                    {fin.vat_review_needed ? <Badge tone="warn">VAT review needed</Badge> : null}
                  </div>
                  {onConsignment ? (
                    <p className="mt-1.5 text-[13px] leading-[1.45] text-body">
                      {consignCoOwner ? `Co-owner / consignee: ${consignCoOwner}. ` : ""}
                      {consignSharePct != null ? `J.v.d.B. share ${consignSharePct}%. ` : ""}
                      {consignSaleHandled === false
                        ? "Sold by a third party, so no VAT for J.v.d.B."
                        : `${consignSaleHandled === true ? "Sale handled by J.v.d.B. · " : ""}VAT: ${vatText}.`}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[13px] leading-[1.45] text-body">
                      {`100% JVB stock · no revenue split. VAT: ${vatText}.`}
                    </p>
                  )}
                </div>
              );
            })()}
          </Section>
        ) : null}

        {/* the sale, once there is one: what it made, the VAT, and who bought it */}
        {showFinancials && fin && hasSale ? (
          <Section title="Sale" meta={fin.sold_date ? `Sold ${formatDate(fin.sold_date, "short")}` : undefined}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Stat label={saleThirdParty ? "Net sold £" : "Sold £"}>{soldGbp != null ? gbpExact(soldGbp) : "—"}</Stat>
              <Stat label="VAT due £" sub={soldGbp != null ? saleVatBasis : null}>
                {soldGbp != null ? gbpExact(saleVat) : "—"}
              </Stat>
              <Stat label="Net of VAT £">{saleNet != null ? gbpExact(saleNet) : "—"}</Stat>
              <div className="min-w-0">
                <dt className="label">Buyer</dt>
                <dd className="mt-1 text-[14.5px] leading-[1.45] text-ink">
                  {buyer ? (
                    <Link href={`/crm/contacts/${buyer.id}`} className="link-plain font-medium">
                      {buyerName}
                    </Link>
                  ) : soldToNote ? (
                    soldToNote
                  ) : (
                    <span className="text-meta">Not recorded</span>
                  )}
                  {buyer && soldToNote ? (
                    <span className="mt-0.5 block text-[12px] leading-[1.4] text-meta">{soldToNote}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </Section>
        ) : null}

        {/* 4 · related, documents, location history, activity */}
        {piece.maker && related.length > 0 ? (
          <Section
            title="More from this maker"
            actions={
              <Link
                href={`/inventory?q=${encodeURIComponent(piece.maker.display_name)}`}
                className="link text-[12px]"
              >
                View all →
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {related.map((r) => {
                const thumb = relatedImg.get(r.id);
                return (
                  <Link key={r.id} href={`/inventory/${encodeURIComponent(r.stock_number)}`} className="group block min-w-0">
                    <div className="jvb-hatch relative aspect-square overflow-hidden">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={r.title ?? r.stock_number} className="h-full w-full object-cover" />
                      ) : null}
                      {r.status === "sold" ? (
                        <Badge size="xs" className="absolute right-1.5 top-1.5">
                          Sold
                        </Badge>
                      ) : null}
                    </div>
                    <p className="tabular mt-1.5 text-[11px] leading-[1.3] text-meta">{r.stock_number}</p>
                    <p className="truncate text-[13px] leading-[1.45] text-body group-hover:text-ink group-hover:underline">
                      {titleWithYear(r.title, r.year)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </Section>
        ) : null}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <Section title="Documents">
            {documents.length === 0 ? (
              <p className="text-[13px] text-meta">No documents attached.</p>
            ) : (
              <ul>
                {documents.map((d) => (
                  <li key={d.id} className="flex items-baseline gap-2 border-t border-rule py-2 first:border-t-0 first:pt-0">
                    <Badge size="xs" className="shrink-0">
                      {labelOf(DOC_TYPE_LABELS, d.doc_type)}
                    </Badge>
                    <Link href={`/documents/${d.id}`} className="link-plain min-w-0 flex-1 truncate text-[13px] text-body">
                      {d.title || "Untitled document"}
                    </Link>
                    {d.storage_path ? (
                      <FilePreviewLink
                        storagePath={d.storage_path}
                        title={d.title || "Document"}
                        className="link shrink-0 text-[12px]"
                      >
                        Preview
                      </FilePreviewLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Location history">
            {(historyRes.data ?? []).length === 0 ? (
              <p className="text-[13px] text-meta">No moves recorded.</p>
            ) : (
              <ul>
                {(historyRes.data ?? []).map((h) => (
                  <li key={h.id} className="flex items-baseline gap-3 border-t border-rule py-2 text-[13px] text-body first:border-t-0 first:pt-0">
                    <span className="tabular w-[84px] shrink-0 text-[12px] text-meta">
                      {formatDate(h.moved_at, "short")}
                    </span>
                    <span>
                      {(h.from_loc as unknown as { code: string } | null)?.code ?? "—"} →{" "}
                      {(h.to_loc as unknown as { code: string } | null)?.code ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section
          title={isAdmin ? "Change history" : "Activity"}
          meta={
            isAdmin
              ? `${formatCount(historyEntries.length)} change${historyEntries.length === 1 ? "" : "s"}`
              : undefined
          }
        >
          {isAdmin ? (
            <ChangeHistory entries={historyEntries} revertAction={revertChange} />
          ) : activityRows.length === 0 ? (
            <p className="text-[13px] text-meta">No activity yet.</p>
          ) : (
            <ul>
              {activityRows.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-rule py-2 first:border-t-0 first:pt-0">
                  <span className="text-[13px] text-body">{a.action}</span>
                  <span className="tabular text-[12px] text-meta">
                    {formatDateTime(a.created_at, "numeric", { seconds: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

/** One figure under its label: the record's money and counts. */
function Stat({ label, sub, children }: { label: string; sub?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1 text-[22px] font-light leading-[1.25] text-ink">{children}</dd>
      {sub ? <dd className="mt-0.5 text-[12px] leading-[1.4] text-meta">{sub}</dd> : null}
    </div>
  );
}

type Dims = {
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
};

const DIM_PARTS: [keyof Dims, string][] = [
  ["height_cm", "H"],
  ["width_cm", "W"],
  ["depth_cm", "D"],
  ["length_cm", "L"],
  ["diameter_cm", "Ø"],
];

function formatDimensions(piece: Dims): string {
  return formatDimensionsCm(piece) ?? "—";
}

/** The same numeric dimensions converted to inches (nearest 1/8"), or null. */
function formatDimensionsInches(piece: Dims): string | null {
  const parts: string[] = [];
  for (const [key, prefix] of DIM_PARTS) {
    const val = piece[key];
    if (typeof val === "number" && val) parts.push(`${prefix} ${cmToInchesFraction(val)}`);
  }
  return parts.length > 0 ? `${parts.join(" × ")} in` : null;
}

/** cm on top, the imperial conversion underneath (when numeric dims exist). */
function renderDimensions(piece: Dims): React.ReactNode {
  const cm = formatDimensions(piece);
  const inches = formatDimensionsInches(piece);
  if (!inches) return cm;
  return (
    <>
      {cm}
      <span className="tabular mt-0.5 block text-[12px] leading-[1.4] text-meta">{inches}</span>
    </>
  );
}

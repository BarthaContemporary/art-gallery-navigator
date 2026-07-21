import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSupabase,
  requireSession,
  canSeeFinancials,
  hasRole,
} from "@/lib/supabase";
import { PieceGallery, type GalleryImage } from "@/components/piece-gallery";
import { StatusPill } from "@/components/status-pill";
import { ChangeHistory, type HistoryEntry } from "@/components/change-history";
import { cmToInchesFraction } from "@/lib/measure";
import { consignmentSplit } from "@/lib/consignment";

export const metadata = { title: "Piece detail" };

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

function gbp(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function PieceDetail({
  params,
}: {
  params: Promise<{ stockNumber: string }>;
}) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();
  const { user, roles } = await requireSession();
  const showFinancials = canSeeFinancials(roles);
  const isAdmin = hasRole(roles, "admin");

  const { data: piece } = await supabase
    .from("pieces")
    .select(
      `*,
       maker:makers(id, display_name, life_dates),
       category:categories(id, name, code),
       location:locations(id, code, name)`,
    )
    .eq("stock_number", stockNumber)
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
  ] = await Promise.all([
    supabase
      .from("piece_images")
      .select("id, role, caption, sort_order, storage_path_display")
      .eq("piece_id", piece.id)
      .order("sort_order"),
    supabase
      .from("provenance_entries")
      .select("id, date_text, party, event_type, details")
      .eq("piece_id", piece.id)
      .order("sort_order"),
    supabase
      .from("piece_watches")
      .select("piece_id")
      .eq("piece_id", piece.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .gte("stock_number", piece.stock_number),
    supabase.from("pieces").select("id", { count: "exact", head: true }),
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
    piece.maker_id
      ? supabase
          .from("pieces")
          .select("id, stock_number, title, status")
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
      .select("doc:piece_documents ( id, doc_type, title, created_at )")
      .eq("piece_id", piece.id),
    supabase
      .from("enquiries")
      .select("id, created_at", { count: "exact" })
      .eq("piece_id", piece.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // adjacent records for prev/next (by stock number ordering)
  const [prevRes, nextRes] = await Promise.all([
    supabase
      .from("pieces")
      .select("stock_number")
      .lt("stock_number", piece.stock_number)
      .order("stock_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pieces")
      .select("stock_number")
      .gt("stock_number", piece.stock_number)
      .order("stock_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const imageRows = imagesRes.data ?? [];
  const images: GalleryImage[] = await Promise.all(
    imageRows.map(async (img) => {
      let url: string | null = null;
      if (img.storage_path_display) {
        const { data } = await supabase.storage
          .from("piece-derivatives")
          .createSignedUrl(img.storage_path_display, 3600);
        url = data?.signedUrl ?? null;
      }
      return {
        id: img.id,
        url,
        caption: img.caption || ROLE_CAPTIONS[img.role] || "Image",
      };
    }),
  );

  const watching = Boolean(watchRes.data);
  const fin = financialsRes.data;
  const total = totalRes.count ?? 0;
  const position = total - (positionRes.count ?? 1) + 1;
  const enquiryCount = enquiriesRes.count ?? 0;
  const lastEnquiry = enquiriesRes.data?.[0]?.created_at;

  // Activity / change history. Admins get the full field-level diff with the
  // name of whoever made each change; other roles see a short recent list
  // (and RLS returns nothing to staff regardless).
  const activityRows = (activityRes.data ?? []) as unknown as Array<{
    id: number | string;
    action: string;
    created_at: string;
    actor_id: string | null;
    entity_type?: string | null;
    changes?: Record<string, unknown> | null;
  }>;
  let historyEntries: HistoryEntry[] = [];
  if (isAdmin) {
    const actorIds = [
      ...new Set(activityRows.map((a) => a.actor_id).filter((x): x is string => Boolean(x))),
    ];
    let names: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      names = Object.fromEntries(
        (profs ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]),
      );
    }
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
      }).jvbShare
    : null;

  const { data: pieceLists } = await supabase
    .from("piece_lists")
    .select("id, name")
    .eq("is_dynamic", false)
    .order("name");

  async function addToList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const listId = String(formData.get("list_id") ?? "");
    if (!listId) return;
    const { data: pieceRow } = await db
      .from("pieces")
      .select("id")
      .eq("stock_number", stockNumber)
      .single();
    if (!pieceRow) return;
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

    if (entry.entity_type === "pieces") {
      patch.updated_by = user.id;
      await db.from("pieces").update(patch).eq("id", piece.id);
    } else if (entry.entity_type === "piece_financials") {
      if (!canSeeFinancials(roles)) return;
      await db.from("piece_financials").update(patch).eq("piece_id", piece.id);
    } else {
      return;
    }
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}`);
  }

  async function toggleWatch() {
    "use server";
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: pieceRow } = await supabase
      .from("pieces")
      .select("id")
      .eq("stock_number", stockNumber)
      .single();
    if (!pieceRow) return;
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

  const specs: [string, React.ReactNode][] = [
    ["Category", piece.category ? `${piece.category.code} · ${piece.category.name}` : "—"],
    ["Medium", piece.medium ?? "—"],
    ["Period", piece.period ?? "—"],
    ["Origin", piece.origin_region ?? "—"],
    ["Dimensions", renderDimensions(piece)],
    ["Weight", piece.weight_g ? `${(piece.weight_g / 1000).toFixed(1)} kg` : "—"],
    ["Location", piece.location?.code ?? "—"],
    ["Acquired", fin?.purchase_date ? new Date(fin.purchase_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"],
    ["Reference", piece.legacy_stock_number ? `Legacy ${piece.legacy_stock_number}` : piece.stock_number],
  ];

  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-8">
      {/* 1 · sticky top chrome */}
      <div className="sticky top-[49px] z-30 flex items-center justify-between gap-3 overflow-x-auto border-b border-line bg-[var(--jvb-bg-header)] px-4 py-3 backdrop-blur-[8px] md:px-[34px] md:py-4">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
          <Link href="/inventory" aria-label="Back to inventory" className="text-ink-mid">
            ←
          </Link>
          <span className="hidden sm:inline">Inventory</span>
          <span className="hidden text-[var(--jvb-ink-separator)] sm:inline">/</span>
          <span className="hidden truncate sm:inline">{piece.category?.name ?? "Uncategorised"}</span>
          <span className="hidden text-[var(--jvb-ink-separator)] sm:inline">/</span>
          <span className="font-mono text-[12px] text-[var(--jvb-ink-body)]">
            {piece.stock_number}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint md:inline">
            Record {position} / {total.toLocaleString("en-GB")}
          </span>
          <span className="flex items-center gap-1">
            {prevRes.data ? (
              <Link
                href={`/inventory/${encodeURIComponent(prevRes.data.stock_number)}`}
                aria-label="Previous record"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line-control text-ink-mid"
              >
                ‹
              </Link>
            ) : null}
            {nextRes.data ? (
              <Link
                href={`/inventory/${encodeURIComponent(nextRes.data.stock_number)}`}
                aria-label="Next record"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line-control text-ink-mid"
              >
                ›
              </Link>
            ) : null}
          </span>
          <span aria-hidden className="hidden h-5 w-px bg-line md:inline-block" />
          <form action={toggleWatch}>
            <button
              type="submit"
              className={`rounded-lg border px-3 py-[7px] text-[12.5px] font-medium transition-colors duration-150 ${
                watching
                  ? "border-[var(--jvb-border-control-active)] bg-control-active text-ink-strong"
                  : "border-line-control bg-control text-ink-mid"
              }`}
            >
              {watching ? "★ Watching" : "☆ Watch"}
            </button>
          </form>
          <Link
            href={`/inventory/${encodeURIComponent(piece.stock_number)}/edit`}
            className="rounded-lg bg-primary px-[15px] py-[7px] text-[12.5px] font-semibold text-primary-fg"
          >
            Edit record
          </Link>
        </div>
      </div>

      {/* documents — fact sheet / certificate as PDF or DOCX (Proton Docs) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-1 pt-3 text-[12px] md:px-8">
        <span className="uppercase tracking-[0.06em] text-ink-faint">Documents</span>
        {(() => {
          const sn = encodeURIComponent(piece.stock_number);
          const links: [string, string][] = [
            ["Fact sheet PDF", `/api/export/fact-sheet.pdf?stock=${sn}`],
            ["DOCX", `/api/export/fact-sheet.docx?stock=${sn}`],
            ["Certificate PDF", `/api/export/certificate.pdf?stock=${sn}`],
            ["DOCX", `/api/export/certificate.docx?stock=${sn}`],
          ];
          return links.map(([label, href], i) => (
            <a
              key={href}
              href={href}
              className={`text-ink-mid hover:text-ink-strong ${i === 2 ? "border-l border-line pl-4" : ""}`}
            >
              {label}
            </a>
          ));
        })()}
      </div>

      {/* add to list — file this work into a static list */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-1 pt-2 text-[12px] md:px-8">
        <span className="uppercase tracking-[0.06em] text-ink-faint">Lists</span>
        {pieceLists && pieceLists.length > 0 ? (
          <form action={addToList} className="flex items-center gap-2">
            <label htmlFor="add-to-list" className="sr-only">
              Add to list
            </label>
            <select
              id="add-to-list"
              name="list_id"
              defaultValue=""
              className="rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body"
            >
              <option value="" disabled>
                Choose a list…
              </option>
              {pieceLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
            >
              Add to list
            </button>
          </form>
        ) : (
          <span className="text-ink-muted">
            No lists yet —{" "}
            <Link href="/inventory/lists" className="text-oranje hover:underline">
              create one
            </Link>
            .
          </span>
        )}
        <Link href="/inventory/lists" className="text-ink-mid hover:text-ink-strong">
          Manage lists →
        </Link>
      </div>

      {/* 2 · main split */}
      <div className="grid grid-cols-1 lg:grid-cols-[640px_1fr]">
        <section className="border-line-soft p-5 md:p-8 lg:border-r lg:pb-[34px] lg:pl-10 lg:pr-8 lg:pt-[38px]">
          <PieceGallery
            images={images}
            stockNumber={piece.stock_number}
            imagesMeta={`${images.length} image${images.length === 1 ? "" : "s"}`}
          />
        </section>

        <section className="p-5 md:p-8 lg:px-[42px] lg:pb-10 lg:pt-[38px]">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={piece.status} />
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
              Stock {piece.stock_number}
            </span>
            {daysInStock != null ? (
              <span className="ml-auto text-[12px] text-ink-soft">
                {daysInStock} days in stock
              </span>
            ) : null}
          </div>

          {piece.maker ? (
            <p className="mt-5 text-[13px] font-medium text-ink-muted">
              <Link href={`/makers?focus=${piece.maker.id}`}>
                {piece.maker.display_name}
                {piece.maker.life_dates ? ` (${piece.maker.life_dates})` : ""}
              </Link>
            </p>
          ) : null}
          <h1 className="mt-1 text-[26px] font-semibold leading-[1.13] tracking-[-0.01em] text-ink-strong md:text-[32px]">
            {piece.title ?? "Untitled"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-muted">
            {[piece.period, piece.origin_region].filter(Boolean).join(" · ") || " "}
          </p>

          {/* spec grid */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[11px] border border-line bg-line sm:grid-cols-3">
            {specs.map(([label, value]) => (
              <div key={label} className="bg-cell px-4 py-[13px]">
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  {label}
                </dt>
                <dd className="mt-0.5 text-[14px] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {piece.description ? (
            <div className="mt-7">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line font-serif text-[15.5px] leading-[1.62] text-[var(--jvb-ink-desc)] [text-wrap:pretty]">
                {piece.description}
              </p>
            </div>
          ) : null}

          {piece.condition_report || piece.signature_inscription ? (
            <div className="mt-7 grid grid-cols-1 gap-[26px] sm:grid-cols-2">
              {piece.condition_report ? (
                <div>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                    Condition
                  </h2>
                  <p className="mt-2 font-serif text-[14.5px] leading-[1.55] text-ink-body">
                    {piece.condition_report}
                  </p>
                </div>
              ) : null}
              {piece.signature_inscription ? (
                <div>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                    Signature
                  </h2>
                  <p className="mt-2 font-serif text-[14.5px] leading-[1.55] text-ink-body">
                    {piece.signature_inscription}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {(provenanceRes.data ?? []).length > 0 ? (
            <div className="mt-7">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Provenance &amp; history
              </h2>
              <ol className="mt-2">
                {(provenanceRes.data ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[70px_1fr] gap-2 border-t border-line-soft py-2.5 first:border-t-0"
                  >
                    <span className="font-mono text-[12px] text-ink-soft">
                      {p.date_text ?? "—"}
                    </span>
                    <span className="font-serif text-[15px] text-[var(--jvb-ink-body)]">
                      {[p.party, p.details].filter(Boolean).join(" — ")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      </div>

      {/* 3 · commercial band — admin/accountant only */}
      {showFinancials && fin ? (
        <div className="grid grid-cols-1 gap-6 border-y border-line bg-band px-5 py-6 md:grid-cols-[2fr_1.15fr] md:gap-9 md:px-[42px] md:py-[26px]">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Marked price">
              <span className="text-[22px] font-semibold text-[var(--jvb-ink-heading)] md:text-[26px]">
                {gbp(fin.marked_price_gbp)}
              </span>
            </Stat>
            <Stat label="Purchase cost">
              <span className="font-mono text-[18px] font-medium text-[var(--jvb-ink-cost)] md:text-[22px]">
                {gbp(fin.total_cost_gbp)}
              </span>
            </Stat>
            <Stat label={useJvbMargin ? "Projected margin (JvdB)" : "Projected margin"}>
              <span className="font-mono text-[18px] text-ink-strong md:text-[22px]">
                {useJvbMargin
                  ? gbp(jvbProjectedMargin)
                  : fin.marked_price_gbp != null && fin.total_cost_gbp != null
                    ? gbp(fin.marked_price_gbp - fin.total_cost_gbp)
                    : "—"}
              </span>
              {useJvbMargin ? (
                <span className="mt-0.5 block font-mono text-[12px] text-ink-muted">
                  {consignSharePct}% share
                </span>
              ) : marginPct ? (
                <span className="mt-0.5 block font-mono text-[12px] text-ink-muted">
                  {marginPct}%
                </span>
              ) : null}
            </Stat>
            <Stat label="Enquiries">
              <span className="font-mono text-[18px] text-ink-strong md:text-[22px]">
                {enquiryCount}
              </span>
              {lastEnquiry ? (
                <span className="mt-0.5 block font-mono text-[12px] text-ink-muted">
                  last {new Date(lastEnquiry).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              ) : null}
            </Stat>
          </div>
          {(() => {
            // Consignment status derives from the Consignment panel fields on
            // the piece (co-owner/consignee, share %, sale-handled), computed
            // above; a legacy consignment_id link still counts.
            const vatText = `${fin.vat_treatment.replace(/_/g, " ")}${fin.vat_review_needed ? " (review needed)" : ""}`;
            return (
              <div className="border-line md:border-l md:pl-9">
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-ink-strong">
                    {onConsignment ? "Consigned" : "Owned outright"}
                  </span>
                  <span className="rounded-[6px] bg-chip px-2 py-0.5 text-[11px] text-ink-body">
                    {onConsignment ? "Consignment" : "Not consigned"}
                  </span>
                </div>
                {onConsignment ? (
                  <p className="mt-1.5 text-[13px] text-ink-muted">
                    {consignCoOwner ? `Co-owner / consignee: ${consignCoOwner}. ` : ""}
                    {consignSharePct != null ? `J.v.d.B. share ${consignSharePct}%. ` : ""}
                    {consignSaleHandled === false
                      ? "Sold by a third party — no VAT for J.v.d.B."
                      : `${consignSaleHandled === true ? "Sale handled by J.v.d.B. · " : ""}VAT: ${vatText}.`}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-ink-muted">
                    {`100% JVB stock · no revenue split. VAT: ${vatText}.`}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      ) : null}

      {/* 4 · related + activity + records */}
      <div className="grid grid-cols-1 gap-8 p-5 md:p-8 lg:grid-cols-[1.5fr_1fr] lg:px-[42px]">
        <section>
          {piece.maker && (relatedRes.data ?? []).length > 0 ? (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                  More from this maker
                </h2>
                <Link
                  href={`/inventory?q=${encodeURIComponent(piece.maker.display_name)}`}
                  className="text-[12px] font-medium text-[var(--jvb-ink-desc)]"
                >
                  View all →
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                {(relatedRes.data ?? []).map((r) => (
                  <Link
                    key={r.id}
                    href={`/inventory/${encodeURIComponent(r.stock_number)}`}
                    className="group"
                  >
                    <div className="jvb-hatch relative aspect-square overflow-hidden rounded-[9px]">
                      <span className="absolute left-2 top-2 font-mono text-[10px] text-ink-muted">
                        {r.stock_number}
                      </span>
                      {r.status === "sold" ? (
                        <span className="absolute right-2 top-2 rounded-[5px] bg-tag-dark px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.05em] text-primary-fg">
                          Sold
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] text-ink-body group-hover:text-ink-strong">
                      {r.title ?? "Untitled"}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          ) : null}

          {/* documents + location history */}
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Documents
              </h2>
              <ul className="mt-2 space-y-1.5">
                {(((documentsRes.data ?? []) as unknown as { doc: { id: string; doc_type: string; title: string | null } | null }[])
                  .map((r) => r.doc)
                  .filter((d): d is NonNullable<typeof d> => Boolean(d))).map((d) => (
                  <li key={d.id} className="flex items-baseline gap-2 text-[13px] text-ink-body">
                    <span className="rounded-[5px] bg-chip px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-ink-mid">
                      {d.doc_type === "import_document" ? "Import Documents" : d.doc_type.replace(/_/g, " ")}
                    </span>
                    <span className="truncate">{d.title}</span>
                  </li>
                ))}
                {(documentsRes.data ?? []).length === 0 ? (
                  <li className="text-[12.5px] text-ink-soft">No documents attached.</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Location history
              </h2>
              <ul className="mt-2 space-y-1.5">
                {(historyRes.data ?? []).map((h) => (
                  <li key={h.id} className="text-[13px] text-ink-body">
                    <span className="font-mono text-[11px] text-ink-soft">
                      {new Date(h.moved_at).toLocaleDateString("en-GB")}
                    </span>{" "}
                    {(h.from_loc as unknown as { code: string } | null)?.code ?? "—"} →{" "}
                    {(h.to_loc as unknown as { code: string } | null)?.code ?? "—"}
                  </li>
                ))}
                {(historyRes.data ?? []).length === 0 ? (
                  <li className="text-[12.5px] text-ink-soft">No moves recorded.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </section>

        <section className="lg:border-l lg:border-line-soft lg:pl-8">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              {isAdmin ? "Change history" : "Activity"}
            </h2>
            {isAdmin ? (
              <span className="font-mono text-[11px] text-ink-soft">
                {historyEntries.length} change{historyEntries.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {isAdmin ? (
            <ChangeHistory entries={historyEntries} revertAction={revertChange} />
          ) : (
            <ul className="mt-3 space-y-2.5">
              {activityRows.map((a, i) => (
                <li key={a.id} className="grid grid-cols-[14px_1fr] gap-2">
                  <span
                    aria-hidden
                    className="mt-[5px] h-[7px] w-[7px] rounded-full"
                    style={{
                      background:
                        i === 0
                          ? "var(--jvb-dot-recent)"
                          : i < 3
                            ? "var(--jvb-dot-mid)"
                            : "var(--jvb-dot-old)",
                    }}
                  />
                  <div>
                    <p className="text-[13.5px] text-ink-body">{a.action}</p>
                    <p className="font-mono text-[11px] text-ink-soft">
                      {new Date(a.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                </li>
              ))}
              {activityRows.length === 0 ? (
                <li className="text-[12.5px] text-ink-soft">No activity yet.</li>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

type Dims = {
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
  dimensions_display: string | null;
};

const DIM_PARTS: [keyof Dims, string][] = [
  ["height_cm", "H"],
  ["width_cm", "W"],
  ["depth_cm", "D"],
  ["length_cm", "L"],
  ["diameter_cm", "Ø"],
];

function formatDimensions(piece: Dims): string {
  const parts: string[] = [];
  for (const [key, prefix] of DIM_PARTS) {
    const val = piece[key];
    if (typeof val === "number" && val) parts.push(`${prefix} ${val}`);
  }
  if (parts.length > 0) return `${parts.join(" × ")} cm`;
  return piece.dimensions_display ?? "—";
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
      <span className="mt-0.5 block font-mono text-[11.5px] text-ink-soft">{inches}</span>
    </>
  );
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabase, createServiceClient, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Work = {
  id: string;
  maker: string | null;
  title: string | null;
  year: string | null;
  medium: string | null;
  dimensions_text: string | null;
  period: string | null;
  origin_region: string | null;
  category: string | null;
  notes: string | null;
};

/**
 * Promote a capture batch's draft works into real inventory pieces, each
 * flagged `needs_completion`. Photos are routed through the normal image
 * pipeline; a linked invoice is attached as a purchase-invoice document and
 * prefills the purchase date / cost.
 */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const userId = gate.session.user.id;
  const { batchId } = (await req.json().catch(() => ({}))) as { batchId?: string };
  if (!batchId) return NextResponse.json({ error: "Missing batch" }, { status: 400 });

  // Reads honour RLS (admin/staff); writes use the service client so the
  // financials table (no staff policy) and cross-bucket copies always succeed.
  const rls = await getSupabase();
  const db = createServiceClient();

  const { data: batch } = await rls
    .from("capture_batches")
    .select("id, captured_at, source_name, source_type, ledger")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const { data: works } = await rls
    .from("capture_works")
    .select("id, maker, title, year, medium, dimensions_text, period, origin_region, category, notes")
    .eq("batch_id", batchId)
    .eq("status", "draft")
    .order("sort_order");

  const purchaseDate = new Date(batch.captured_at).toISOString().slice(0, 10);
  const results: { workId: string; stockNumber?: string; error?: string }[] = [];

  for (const work of (works ?? []) as Work[]) {
    try {
      const stockNumber = await pushWork(db, work, { userId, batch, purchaseDate });
      results.push({ workId: work.id, stockNumber });
    } catch (e) {
      results.push({ workId: work.id, error: e instanceof Error ? e.message : "Push failed" });
    }
  }

  // If everything pushed, close the batch.
  const { count: remaining } = await rls
    .from("capture_works")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "draft");
  if ((remaining ?? 0) === 0) await db.from("capture_batches").update({ status: "pushed" }).eq("id", batchId);

  return NextResponse.json({ results });
}

type Ctx = {
  userId: string;
  batch: {
    id: string;
    source_name: string | null;
    source_type: string | null;
    ledger: "jvb" | "external";
  };
  purchaseDate: string;
};

async function pushWork(
  db: ReturnType<typeof createServiceClient>,
  work: Work,
  ctx: Ctx,
): Promise<string> {
  // 1. Maker: reuse an existing one by name, else create it.
  let makerId: string | null = null;
  if (work.maker?.trim()) {
    const name = work.maker.trim();
    const { data: existing } = await db
      .from("makers")
      .select("id")
      .ilike("display_name", name)
      .limit(1)
      .maybeSingle();
    if (existing) makerId = existing.id;
    else {
      const { data: created } = await db.from("makers").insert({ display_name: name }).select("id").single();
      makerId = created?.id ?? null;
    }
  }

  const comments = [
    ctx.batch.source_name ? `Purchased from: ${ctx.batch.source_name}` : null,
    work.category?.trim() ? `Category (from capture): ${work.category.trim()}` : null,
    // Whatever was typed or detected at the fair, kept as a note for whoever
    // catalogues the record rather than written to a column. Dimensions are
    // numeric cm fields now, and the capture text is free-form ("approx 20cm
    // with stand"), so it is not safe to parse into them unattended.
    work.dimensions_text?.trim()
      ? `Dimensions (from capture): ${work.dimensions_text.trim()}`
      : null,
    "Created via Quick Capture — needs completion.",
  ]
    .filter(Boolean)
    .join("\n");

  // 2. The piece itself, flagged for completion. A batch marked "not JvdB" at
  // capture time files straight into the second register and gets a number from
  // that series; everything else about the record is identical.
  const { data: piece, error: pErr } = await db
    .from(ctx.batch.ledger === "external" ? "external_pieces" : "pieces")
    .insert({
      title: work.title?.trim() || null,
      maker_id: makerId,
      year: work.year?.trim() || null,
      medium: work.medium?.trim() || null,
      period: work.period?.trim() || null,
      origin_region: work.origin_region?.trim() || null,
      description: work.notes?.trim() || null,
      comments,
      tags: ["capture"],
      needs_completion: true,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, stock_number")
    .single();
  if (pErr || !piece) throw new Error(pErr?.message ?? "Could not create piece");

  // 3. Photos → piece-originals + pending piece_images rows.
  const { data: photos } = await db
    .from("capture_photos")
    .select("id, storage_path, is_label, sort_order")
    .eq("work_id", work.id)
    .order("sort_order")
    .order("created_at");

  let firstPhoto = true;
  let sort = 0;
  for (const ph of photos ?? []) {
    const bytes = await download(db, ph.storage_path);
    if (!bytes) continue;
    const ext = ph.storage_path.split(".").pop()?.toLowerCase() || "jpg";
    const dest = `${piece.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage
      .from("piece-originals")
      .upload(dest, bytes, { contentType: "image/jpeg" });
    if (upErr) continue;
    const role = ph.is_label ? "document" : firstPhoto ? "front" : "detail";
    if (!ph.is_label) firstPhoto = false;
    await db.from("piece_images").insert({
      piece_id: piece.id,
      role,
      sort_order: sort++,
      storage_path_original: dest,
      processing_status: "pending",
    });
  }

  // 4. Linked invoice → purchase-invoice document + prefilled financials.
  await attachInvoice(db, work.id, piece.id, ctx.purchaseDate);

  // Ensure a purchase date is recorded even without an invoice.
  await db
    .from("piece_financials")
    .update({ purchase_date: ctx.purchaseDate })
    .eq("piece_id", piece.id)
    .is("purchase_date", null);

  // 5. Mark the capture work as pushed.
  await db
    .from("capture_works")
    .update({ status: "pushed", pushed_piece_id: piece.id, pushed_at: new Date().toISOString() })
    .eq("id", work.id);

  return piece.stock_number as string;
}

async function attachInvoice(
  db: ReturnType<typeof createServiceClient>,
  workId: string,
  pieceId: string,
  fallbackDate: string,
) {
  const { data: links } = await db
    .from("capture_invoice_links")
    .select("invoice_id")
    .eq("work_id", workId);
  const invoiceId = links?.[0]?.invoice_id;
  if (!invoiceId) return;

  const { data: invoice } = await db
    .from("capture_invoices")
    .select("id, vendor, reference, invoice_date, total, currency")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;

  // How many works does this invoice cover? Only prefill cost when it's one.
  const { count: linkCount } = await db
    .from("capture_invoice_links")
    .select("work_id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .not("work_id", "is", null);

  const { data: pages } = await db
    .from("capture_invoice_pages")
    .select("storage_path, squared_path, page_no")
    .eq("invoice_id", invoiceId)
    .order("page_no");

  // Attach the first page (prefer the squared version) as the document.
  let documentId: string | null = null;
  const first = pages?.[0];
  const srcPath = first?.squared_path || first?.storage_path;
  if (srcPath) {
    const bytes = await download(db, srcPath);
    if (bytes) {
      const ext = srcPath.split(".").pop()?.toLowerCase() || "jpg";
      const dest = `${pieceId}/${randomUUID()}.${ext}`;
      const { error } = await db.storage
        .from("piece-documents")
        .upload(dest, bytes, { contentType: "image/jpeg" });
      if (!error) {
        const { data: doc } = await db
          .from("piece_documents")
          .insert({
            piece_id: pieceId,
            doc_type: "purchase_invoice",
            title: invoice.vendor ? `Invoice — ${invoice.vendor}` : "Purchase invoice",
            storage_path: dest,
            issued_by: invoice.vendor ?? null,
            issued_date: invoice.invoice_date ?? null,
            notes: (pages?.length ?? 0) > 1 ? `${pages!.length} pages (first page attached)` : null,
          })
          .select("id")
          .single();
        documentId = doc?.id ?? null;
      }
    }
  }

  const fin: Record<string, unknown> = {
    purchase_date: invoice.invoice_date ?? fallbackDate,
  };
  if (documentId) fin.purchase_invoice_document_id = documentId;
  if ((linkCount ?? 0) <= 1 && invoice.total != null) {
    fin.purchase_cost = invoice.total;
    if (invoice.currency) fin.purchase_currency = invoice.currency;
  }
  await db.from("piece_financials").update(fin).eq("piece_id", pieceId);
}

/** Download a captures-bucket object to a Buffer. */
async function download(
  db: ReturnType<typeof createServiceClient>,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await db.storage.from("captures").download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

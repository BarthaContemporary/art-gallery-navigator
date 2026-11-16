import { safeStoragePath, UUID_PATTERN } from "@jvb/db/storage-path";
import type { createServiceClient } from "@jvb/db/server";

/**
 * Pushing a capture batch into the inventory, and attaching a captured
 * invoice to a stock record. Used by /api/capture/push and
 * /api/capture/invoice/[id]/link. No path aliases and no relative imports,
 * so `node --test` can load it (push.test.ts runs it against a fake client).
 *
 * A push can be retried, cut off by the platform's time limit, or run twice
 * at once (a second Confirm, a second phone), so every step can be repeated
 * without creating anything twice:
 *
 * 1. Each work is claimed before anything is created for it: pushed_at is
 *    set as a lease, only on a draft whose lease is free or older than
 *    LEASE_MINUTES. A work another run holds is reported as busy.
 * 2. pushed_piece_id is written straight after the stock record is created;
 *    a claimed work that already has one continues on that record.
 * 3. Photos are copied to `<piece>/<capture photo id>.<ext>` and skipped when
 *    that piece_images row exists; the invoice page goes to
 *    `<piece>/<page id>.<ext>` and is skipped when that document exists.
 * 4. A work is marked pushed only when every photo and the invoice made it.
 *    Otherwise it stays a draft, with its stock record, and the lease is
 *    released so pushing again finishes it.
 *
 * Needs no database object beyond those of migration 0030 and 0056.
 */

type Db = ReturnType<typeof createServiceClient>;

/** How long a claim on a work holds. Longer than the route's maxDuration (300 s). */
export const LEASE_MINUTES = 10;

const TEXT_FIELDS = [
  "maker",
  "title",
  "year",
  "medium",
  "dimensions_text",
  "period",
  "origin_region",
  "category",
  "notes",
] as const;

type Work = { id: string; pushed_piece_id: string | null } & Partial<Record<(typeof TEXT_FIELDS)[number], string | null>>;

type Batch = {
  id: string;
  captured_at: string;
  source_name: string | null;
  source_type: string | null;
  ledger: "jvb" | "external";
};

type Photo = { id: string; storage_path: string; is_label: boolean };

type Invoice = {
  id: string;
  vendor: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  created_at?: string | null;
};

export type WorkResult = {
  workId: string;
  /** The stock record's number, once it exists. */
  stockNumber?: string;
  /** Photos that could not be copied this time. */
  photosFailed?: number;
  /** The linked invoice could not be attached this time. */
  invoiceFailed?: boolean;
  /** The stock record exists but something is missing: push again to finish. */
  incomplete?: boolean;
  /** Another push is adding this work right now. */
  busy?: boolean;
  /** No photos and no text: nothing was added (status 'skipped'). */
  skipped?: boolean;
  error?: string;
};

export type PushOutcome = { found: false } | { found: true; results: WorkResult[]; closed: boolean };

/**
 * The calendar day in London of a timestamp, as yyyy-mm-dd. The purchase date
 * of a batch: the gallery's own day, which is also the phone's for anything
 * bought in the UK (the UTC day was a day early after midnight in summer).
 */
export function londonDay(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** A work with nothing in it: no photo and every field blank. */
export function isEmptyWork(work: Partial<Record<string, unknown>>, photoCount: number): boolean {
  if (photoCount > 0) return false;
  return TEXT_FIELDS.every((f) => String(work[f] ?? "").trim() === "");
}

/**
 * The embedded select a batch list needs to count its waiting works, and the
 * count: draft works that hold something (an empty card left by opening the
 * capture screen is not waiting for anything).
 */
export const WAITING_WORKS_SELECT =
  "capture_works(status, maker, title, year, medium, dimensions_text, period, origin_region, category, notes, capture_photos(count))";

export function waitingWorks(works: unknown): number {
  if (!Array.isArray(works)) return 0;
  return works.filter((w: Record<string, unknown>) => {
    if (w?.status !== "draft") return false;
    const photos = (w.capture_photos as { count?: number }[] | null | undefined)?.[0]?.count ?? 0;
    return !isEmptyWork(w, photos);
  }).length;
}

/** A name compared without case, accents, macrons or extra spaces. */
export function foldName(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * An ILIKE pattern that finds every maker whose name could fold to the same
 * as `name`: vowels and non-ASCII letters become `_` (one character), so
 * "Unno Shomin" also finds "Unno Shōmin"; `%`, `_` and `\` are escaped, and
 * `*` (PostgREST's other wildcard) becomes `_`. Candidates are then compared
 * exactly with foldName().
 */
export function makerPattern(name: string): string {
  let out = "";
  for (const ch of name.normalize("NFC").replace(/\s+/g, " ").trim()) {
    if (ch === "%" || ch === "_" || ch === "\\") out += `\\${ch}`;
    else if (ch === "*") out += "_";
    else if (/[aeiouy]/i.test(ch) || ch.charCodeAt(0) > 0x7f) out += "_";
    else out += ch;
  }
  return out;
}

/**
 * The existing maker this name means, when exactly one maker's name is the
 * same once case and accents are set aside; else null. Capture never creates
 * a maker: makers publish to the website unless switched off, and the name on
 * a fair label is not a cataloguer's decision. An unmatched name goes into
 * the record's comments for the studio to link or add.
 */
export async function findMaker(db: Db, name: string): Promise<string | null> {
  const want = foldName(name);
  if (!want) return null;
  const { data, error } = await db
    .from("makers")
    .select("id, display_name")
    .ilike("display_name", makerPattern(name))
    .limit(50);
  if (error) throw new Error(`Could not look up the maker: ${error.message}`);
  const same = ((data ?? []) as { id: string; display_name: string | null }[]).filter(
    (m) => foldName(m.display_name ?? "") === want,
  );
  return same.length === 1 ? same[0]!.id : null;
}

/**
 * A captures-bucket path read from a capture row, when it is one file
 * directly under `dir` (a pattern: the work's or invoice's own folder), else
 * null. The service role copies these files into piece-originals and
 * piece-documents, and no storage policy limits it, so a row pointing out of
 * the captures bucket ("works/…/../../piece-documents/<invoice>") must never
 * be followed (security review 2026-10, F6). Migration 0090 holds new rows
 * to these shapes as well.
 */
export function capturePath(path: unknown, dir: string): string | null {
  return safeStoragePath(path, { pattern: new RegExp(`^${dir}/[^/]+$`) });
}

/** The file extension to keep on a copy: letters and digits only, else jpg. */
export function extOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "") || "jpg";
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};
const contentTypeOf = (ext: string) => CONTENT_TYPES[ext] ?? "image/jpeg";

/** Download a captures-bucket object to a Buffer. */
async function download(db: Db, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await db.storage.from("captures").download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function copyFile(db: Db, src: string, bucket: string, dest: string): Promise<boolean> {
  const bytes = await download(db, src);
  if (!bytes) return false;
  try {
    // upsert: a run cut off after the upload but before its row may have
    // left the file there; the retry writes the same bytes again.
    const { error } = await db.storage
      .from(bucket)
      .upload(dest, bytes, { contentType: contentTypeOf(extOf(dest)), upsert: true });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Invoice → stock record
// ---------------------------------------------------------------------------

/**
 * Attach a captured invoice's first page (its squared version when there is
 * one) to a stock record as a purchase-invoice document, once: a document at
 * `<piece>/<page id>.*` already there is reused. With `prefill`, fill the
 * record's purchase invoice link, purchase date and (with `setCost`, when the
 * invoice covers this one item only) purchase cost and currency, each only
 * where it is still empty: costs already entered are never replaced.
 * Returns false when something could not be done; nothing is left half
 * written that a second call would duplicate.
 */
export async function attachInvoiceToPiece(
  db: Db,
  invoice: Invoice,
  pieceId: string,
  opts: { prefill: boolean; setCost: boolean },
): Promise<boolean> {
  const { data: pages, error: pErr } = await db
    .from("capture_invoice_pages")
    .select("id, storage_path, squared_path, page_no")
    .eq("invoice_id", invoice.id)
    .order("page_no");
  if (pErr) return false;
  const list = (pages ?? []) as { id: string; storage_path: string; squared_path: string | null }[];

  let documentId: string | null = null;
  const first = list[0];
  if (first) {
    // Only a page of this invoice, where the capture upload route put it.
    const pageDir = `invoices/${invoice.id}`;
    const src = capturePath(first.squared_path, pageDir) ?? capturePath(first.storage_path, pageDir);
    if (!src) return false;
    if (!new RegExp(`^${UUID_PATTERN}$`).test(first.id) || !new RegExp(`^${UUID_PATTERN}$`).test(pieceId)) return false;

    const { data: existing, error: eErr } = await db
      .from("piece_documents")
      .select("id")
      .eq("piece_id", pieceId)
      .like("storage_path", `${pieceId}/${first.id}.%`)
      .limit(1);
    if (eErr) return false;
    documentId = ((existing ?? []) as { id: string }[])[0]?.id ?? null;

    if (!documentId) {
      const dest = `${pieceId}/${first.id}.${extOf(src)}`;
      if (!(await copyFile(db, src, "piece-documents", dest))) return false;
      const { data: doc, error: dErr } = await db
        .from("piece_documents")
        .insert({
          piece_id: pieceId,
          doc_type: "purchase_invoice",
          title: invoice.vendor ? `Invoice — ${invoice.vendor}` : "Purchase invoice",
          storage_path: dest,
          issued_by: invoice.vendor ?? null,
          issued_date: invoice.invoice_date ?? null,
          notes: list.length > 1 ? `${list.length} pages (first page attached)` : null,
        })
        .select("id")
        .single();
      if (dErr || !doc) return false;
      documentId = (doc as { id: string }).id;
    }
  }

  if (!opts.prefill) return true;

  // Each value only where the record has none yet.
  const fills: [string, Record<string, unknown>][] = [];
  if (documentId) fills.push(["purchase_invoice_document_id", { purchase_invoice_document_id: documentId }]);
  if (invoice.invoice_date) fills.push(["purchase_date", { purchase_date: invoice.invoice_date }]);
  if (opts.setCost && invoice.total != null) {
    fills.push([
      "purchase_cost",
      { purchase_cost: invoice.total, ...(invoice.currency ? { purchase_currency: invoice.currency } : {}) },
    ]);
  }
  for (const [column, patch] of fills) {
    const { error } = await db.from("piece_financials").update(patch).eq("piece_id", pieceId).is(column, null);
    if (error) return false;
  }
  return true;
}

/** How many works and stock records an invoice is linked to; null if unknown. */
export async function invoiceItemCount(db: Db, invoiceId: string): Promise<number | null> {
  const { count, error } = await db
    .from("capture_invoice_links")
    .select("invoice_id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);
  return error || count == null ? null : count;
}

/**
 * Attach every invoice linked to a capture work to its stock record, newest
 * first. The purchase date and cost are prefilled only from a single linked
 * invoice (and the cost only when that invoice covers this one item); with
 * several, the documents are attached and the figures left to the studio.
 */
async function attachWorkInvoices(db: Db, workId: string, pieceId: string): Promise<boolean> {
  const { data: links, error } = await db.from("capture_invoice_links").select("invoice_id").eq("work_id", workId);
  if (error) return false;
  const ids = [...new Set(((links ?? []) as { invoice_id: string }[]).map((l) => l.invoice_id))];
  if (ids.length === 0) return true;

  const { data: rows, error: iErr } = await db
    .from("capture_invoices")
    .select("id, vendor, reference, invoice_date, total, currency, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (iErr) return false;
  const invoices = (rows ?? []) as Invoice[];

  let ok = true;
  for (const invoice of invoices) {
    const prefill = invoices.length === 1;
    const items = prefill ? await invoiceItemCount(db, invoice.id) : null;
    const done = await attachInvoiceToPiece(db, invoice, pieceId, {
      prefill,
      setCost: items !== null && items <= 1,
    });
    if (!done) ok = false;
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Capture work → stock record
// ---------------------------------------------------------------------------

/** Claim a draft work for this run; null when another run holds it. */
async function claim(db: Db, workId: string, now: Date): Promise<{ pushed_piece_id: string | null } | null> {
  const lease = { pushed_at: now.toISOString() };
  const free = await db
    .from("capture_works")
    .update(lease)
    .eq("id", workId)
    .eq("status", "draft")
    .is("pushed_at", null)
    .select("id, pushed_piece_id");
  if (free.error) throw new Error(free.error.message);
  if (free.data?.length) return free.data[0] as { pushed_piece_id: string | null };

  const cutoff = new Date(now.getTime() - LEASE_MINUTES * 60_000).toISOString();
  const stale = await db
    .from("capture_works")
    .update(lease)
    .eq("id", workId)
    .eq("status", "draft")
    .lt("pushed_at", cutoff)
    .select("id, pushed_piece_id");
  if (stale.error) throw new Error(stale.error.message);
  if (stale.data?.length) return stale.data[0] as { pushed_piece_id: string | null };
  return null;
}

async function release(db: Db, workId: string) {
  await db.from("capture_works").update({ pushed_at: null }).eq("id", workId).eq("status", "draft");
}

async function stockNumberOf(db: Db, pieceId: string): Promise<string | undefined> {
  for (const table of ["pieces", "external_pieces"]) {
    const { data } = await db.from(table).select("stock_number").eq("id", pieceId).maybeSingle();
    if (data) return (data as { stock_number: string | null }).stock_number ?? undefined;
  }
  return undefined;
}

type Ctx = { db: Db; userId: string; batch: Batch; purchaseDate: string; now: Date };

async function createPiece(ctx: Ctx, work: Work): Promise<{ id: string; stock_number: string }> {
  const clean = (v: string | null | undefined) => v?.trim() || null;
  const makerText = clean(work.maker);
  const makerId = makerText ? await findMaker(ctx.db, makerText) : null;

  const comments = [
    ctx.batch.source_name ? `Purchased from: ${ctx.batch.source_name}` : null,
    makerText && !makerId ? `Maker (from capture): ${makerText}` : null,
    clean(work.category) ? `Category (from capture): ${clean(work.category)}` : null,
    // Whatever was typed or detected at the fair, kept as a note for whoever
    // catalogues the record rather than written to a column. Dimensions are
    // numeric cm fields now, and the capture text is free-form ("approx 20cm
    // with stand"), so it is not safe to parse into them unattended.
    clean(work.dimensions_text) ? `Dimensions (from capture): ${clean(work.dimensions_text)}` : null,
    "Created via Quick Capture — needs completion.",
  ]
    .filter(Boolean)
    .join("\n");

  // A batch marked "not JvdB" at capture time files straight into the second
  // register and gets a number from that series; everything else about the
  // record is identical.
  const { data, error } = await ctx.db
    .from(ctx.batch.ledger === "external" ? "external_pieces" : "pieces")
    .insert({
      title: clean(work.title),
      maker_id: makerId,
      year: clean(work.year),
      medium: clean(work.medium),
      period: clean(work.period),
      origin_region: clean(work.origin_region),
      description: clean(work.notes),
      comments,
      tags: ["capture"],
      needs_completion: true,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, stock_number")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the stock record");
  return data as { id: string; stock_number: string };
}

/** Copy the work's photos onto the record; returns how many failed. */
async function copyPhotos(db: Db, workId: string, pieceId: string, photos: Photo[]): Promise<number> {
  const { data: existing, error } = await db
    .from("piece_images")
    .select("storage_path_original")
    .eq("piece_id", pieceId);
  if (error) return photos.length;
  const have = new Set(((existing ?? []) as { storage_path_original: string | null }[]).map((r) => r.storage_path_original));

  let failed = 0;
  let firstObjectPhoto = true;
  for (const [i, ph] of photos.entries()) {
    // Roles follow the capture order, so a resumed push gives the same ones.
    const role = ph.is_label ? "document" : firstObjectPhoto ? "front" : "detail";
    if (!ph.is_label) firstObjectPhoto = false;

    // Only this work's own photos, where the capture upload route put them.
    // A row pointing anywhere else is never followed, and retrying would not
    // change that, so it does not hold the work back.
    const src = capturePath(ph.storage_path, `works/${UUID_PATTERN}/${workId}`);
    if (!src || !new RegExp(`^${UUID_PATTERN}$`).test(ph.id)) continue;
    const dest = `${pieceId}/${ph.id}.${extOf(src)}`;
    if (have.has(dest)) continue;
    if (!(await copyFile(db, src, "piece-originals", dest))) {
      failed++;
      continue;
    }
    const { error: iErr } = await db.from("piece_images").insert({
      piece_id: pieceId,
      role,
      sort_order: i,
      storage_path_original: dest,
      processing_status: "pending",
    });
    if (iErr) failed++;
  }
  return failed;
}

async function pushWork(ctx: Ctx, work: Work): Promise<WorkResult> {
  const { db } = ctx;
  let lease: { pushed_piece_id: string | null } | null;
  try {
    lease = await claim(db, work.id, ctx.now);
  } catch (e) {
    return { workId: work.id, error: e instanceof Error ? e.message : "Push failed" };
  }
  if (!lease) return { workId: work.id, busy: true };

  let pieceId = lease.pushed_piece_id;
  let stockNumber: string | undefined;
  let keepLease = false;
  try {
    const { data: photoRows, error: phErr } = await db
      .from("capture_photos")
      .select("id, storage_path, is_label, sort_order")
      .eq("work_id", work.id)
      .order("sort_order")
      .order("created_at");
    if (phErr) throw new Error(`Could not read the photos: ${phErr.message}`);
    const photos = (photoRows ?? []) as Photo[];

    if (!pieceId && isEmptyWork(work, photos.length)) {
      const { error } = await db
        .from("capture_works")
        .update({ status: "skipped", pushed_at: null })
        .eq("id", work.id);
      if (error) throw new Error(error.message);
      return { workId: work.id, skipped: true };
    }

    if (pieceId) {
      stockNumber = await stockNumberOf(db, pieceId);
    } else {
      const piece = await createPiece(ctx, work);
      pieceId = piece.id;
      stockNumber = piece.stock_number;
      const { error } = await db.from("capture_works").update({ pushed_piece_id: piece.id }).eq("id", work.id);
      if (error) {
        // Keep the claim: releasing it would let a retry create a second
        // record. It lapses after LEASE_MINUTES.
        keepLease = true;
        throw new Error(
          `Added as ${piece.stock_number}, but the capture could not be marked. Check the studio before pushing again.`,
        );
      }
    }

    const photosFailed = await copyPhotos(db, work.id, pieceId, photos);
    let invoiceOk = await attachWorkInvoices(db, work.id, pieceId);

    // A purchase date even without an invoice: the batch's day.
    const { error: dErr } = await db
      .from("piece_financials")
      .update({ purchase_date: ctx.purchaseDate })
      .eq("piece_id", pieceId)
      .is("purchase_date", null);
    if (dErr) invoiceOk = false;

    if (photosFailed > 0 || !invoiceOk) {
      await release(db, work.id);
      return {
        workId: work.id,
        stockNumber,
        incomplete: true,
        ...(photosFailed ? { photosFailed } : {}),
        ...(!invoiceOk ? { invoiceFailed: true } : {}),
      };
    }

    const { error: mErr } = await db
      .from("capture_works")
      .update({ status: "pushed", pushed_piece_id: pieceId, pushed_at: ctx.now.toISOString() })
      .eq("id", work.id);
    if (mErr) throw new Error(`Could not mark the work as added: ${mErr.message}`);
    return { workId: work.id, stockNumber };
  } catch (e) {
    if (!keepLease) await release(db, work.id).catch(() => undefined);
    return {
      workId: work.id,
      ...(stockNumber ? { stockNumber, incomplete: true } : {}),
      error: e instanceof Error ? e.message : "Push failed",
    };
  }
}

/**
 * Promote a capture batch's draft works into stock records, each flagged
 * `needs_completion`. Reads go through `rls` (the signed-in admin or staff
 * user); writes through `db` (the service role), because staff have no
 * policy on piece_financials and the copies cross buckets.
 */
export async function pushBatch(opts: {
  rls: Db;
  db: Db;
  batchId: string;
  userId: string;
  now?: Date;
}): Promise<PushOutcome> {
  const { rls, db, batchId, userId } = opts;
  const now = opts.now ?? new Date();

  const { data: batch } = await rls
    .from("capture_batches")
    .select("id, captured_at, source_name, source_type, ledger")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { found: false };

  const { data: works, error } = await rls
    .from("capture_works")
    .select("id, maker, title, year, medium, dimensions_text, period, origin_region, category, notes, pushed_piece_id")
    .eq("batch_id", batchId)
    .eq("status", "draft")
    .order("sort_order");
  if (error) throw new Error(error.message);

  const ctx: Ctx = {
    db,
    userId,
    batch: batch as Batch,
    purchaseDate: londonDay((batch as Batch).captured_at),
    now,
  };
  const results: WorkResult[] = [];
  for (const work of (works ?? []) as Work[]) results.push(await pushWork(ctx, work));

  // Close the batch only when the count says nothing is left.
  const { count, error: cErr } = await rls
    .from("capture_works")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "draft");
  let closed = false;
  if (!cErr && count === 0) {
    const { error: uErr } = await db.from("capture_batches").update({ status: "pushed" }).eq("id", batchId);
    closed = !uErr;
  }
  return { found: true, results, closed };
}

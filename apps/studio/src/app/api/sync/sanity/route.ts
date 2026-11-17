import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { resolvePieces } from "@/lib/piece-store";
import { resolveListPieceIds, type ListLike } from "@/lib/list-members";
import { selectInChunks } from "@/lib/chunk";
import { detectPortraitFocus, sanityFraming, type PortraitFocus } from "@/lib/face/focus";
import { analysePhotograph, flatWorkHint, renderObjectSquare, renderPhotoSquare, type Analysed, type Box } from "@/lib/squares";
import { DIMENSION_COLUMNS, formatDimensionsFullCm, type PieceDimensions } from "@jvb/db";
import { safeStoragePath } from "@jvb/db/storage-path";
import { WEBSITE_IMAGE_ROLES, displayMasterRule, isUuid, portraitRule, squareTileRule } from "@/lib/website-images";
import { deleteUnusedAssets, forgetMissingAssets } from "@/lib/sanity-assets";
import {
  artistDocId,
  listDocId,
  downloadForSync,
  ensureImageAsset,
  htmlToText,
  loadAssetCache,
  sanityEnv,
  sanityMutate,
  slugify,
  SyncRetryError,
  workDocId,
} from "@/lib/sanity-sync";
import {
  entityKey,
  failedWriteState,
  HOLD_LIMIT_MS,
  heldSince,
  heldTooLong,
  overlappedEntities,
  settleBatch,
  storageFailureIsPermanent,
  type OutboxRow,
  type Outcome,
  type StateUpdate,
  type SyncEntity,
} from "@/lib/sanity-sync-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Outbox rows per run — images make each piece heavier than before. */
const BATCH = 12;
/** Images pushed per work: enough for the fold-out panel, not the archive. */
const IMAGES_PER_WORK = 8;
/** How long a database wake-up waits for the rest of a burst of edits. */
const SETTLE_MS = 4000;
/** Keep draining batches this long per invocation (maxDuration is 60 s). */
const TIME_BUDGET_MS = 42_000;
/**
 * Square tiles are rendered only while this much of the invocation remains
 * unspent; a batch of a dozen objects would otherwise outlast the function.
 * Pieces whose tile had to wait are queued again and finished by the next
 * wake-up, which the queue itself raises.
 */
const RENDER_BUDGET_MS = 24_000;
/**
 * A work's photographs are uploaded only this long into the invocation
 * (counted after the settle, so 56 s remain of maxDuration). A work whose
 * next upload would start later is left whole, nothing of it written, and
 * queued again for a fresh invocation; what it uploaded so far is
 * remembered. The rest of the time is for the upload in flight, the tile,
 * the write, the deletes and the cleanup.
 */
const WORK_BUDGET_MS = 32_000;

/**
 * Supabase → Sanity sync (one way). Woken by the database the moment an
 * outbox row is written (pg_net trigger, migration 0074), by Admin → Resync,
 * and by a Vercel cron as the fallback drain. Pushes web-visible pieces as
 * read-only `work` documents with their display images (views of the work
 * only: WEBSITE_IMAGE_ROLES), and makers as `artist` documents (every maker,
 * unless switched off); unpublishes pieces and makers that are no longer
 * web-visible, and pieces in the trash. Once the documents are written, the
 * images the sync had uploaded for them that nothing uses any more are
 * deleted from Sanity (lib/sanity-assets.ts).
 *
 * Nothing goes out on data the sync could not read. A failed read of the
 * batch's rows leaves the whole claim to lapse; a work, artist or list whose
 * own read or upload fails (a list's membership, a photograph Sanity or
 * storage would not take just then, a delete refused for any reason but a
 * reference) is held back on its own: nothing of it is written, its rows
 * stay unprocessed, and a later run retries it while the rest of the batch
 * goes out (HOLD_LIMIT_MS bounds how long, counted from the first run that
 * held it, which its sync state records). Entity outcomes and what they
 * write back are in lib/sanity-sync-rules.ts.
 *
 * Every storage path read here comes from a database column that staff can
 * write, and the downloads use the service role, so each one is checked
 * against the shape the pipeline gives it (lib/website-images.ts) and
 * skipped when it does not fit: a path that climbed into another bucket
 * would otherwise publish that file to the public CDN.
 */
type Db = Parameters<typeof ensureImageAsset>[0];

/** Download a storage object and find the face in it; null when either fails. */
async function detectFocusInStorage(supabase: Db, bucket: string, path: string): Promise<PortraitFocus | null> {
  if (!safeStoragePath(path)) return null;
  try {
    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error || !blob) return null;
    return await detectPortraitFocus(Buffer.from(await blob.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Download a storage object as a buffer; null when it is missing (or its
 * path is refused). Throws SyncRetryError when storage failed in a way a
 * later run may not, so the work waits rather than go out without its tile.
 */
async function downloadBuffer(supabase: Db, bucket: string, path: string): Promise<Buffer | null> {
  if (!safeStoragePath(path)) return null;
  return (await downloadForSync(supabase, bucket, path))?.buffer ?? null;
}

/** How a work's square tile is drawn: fitted on white, rendered on the extended backdrop, or the photograph as taken cut square around the piece. */
type Presentation = "flat" | "object" | "photo";

/** The owner's "Website square" choice on the piece, when it is not auto. */
const forcedPresentation = (p: string | null): Presentation | null => (p === "flat" || p === "object" || p === "photo" ? p : null);

type Square = { kind: Presentation | null; squarePath: string | null; rendered: boolean; deferred: boolean };

/** What the sync decided for a display master before (piece_image_squares). */
type SquareRow = {
  image_id: string;
  guess: Presentation;
  kind: Presentation;
  square_path: string | null;
  source_width: number | null;
  source_height: number | null;
  /** The catalogue hint the guess was made with; null on rows from before it was recorded. */
  flat_hint: boolean | null;
};

/**
 * The square tile for a work's first photograph. A flat work is fitted on
 * white by the website itself; an object gets a rendered square (centred,
 * backdrop extended) stored beside the display master. The owner's choice on
 * the piece overrides the photograph's reading. Analysis and rendering happen
 * once per master; the row remembers them. Null kind: nothing could be
 * decided (the master is not in storage, or would not render), so the
 * website keeps its crop. A storage failure that may pass throws
 * SyncRetryError instead, and the work waits for a later run.
 */
async function ensureSquare(
  supabase: Db,
  piece: { id: string; presentation: string | null; medium: string | null; title: string | null },
  img: { id: string; path: string; width: number | null; height: number | null },
  row: SquareRow | null,
  renderUntil: number,
): Promise<Square> {
  const forced = forcedPresentation(piece.presentation);
  const flatHint = flatWorkHint(piece.medium, piece.title);
  // Same master as before: the rendered square still holds; the guess only
  // if the catalogue hint it was made with has not changed.
  const sameMaster = !!row && row.source_width === img.width && row.source_height === img.height;
  const fresh = sameMaster && row!.flat_hint === flatHint;
  let master: Buffer | null | undefined;
  const load = async () => (master === undefined ? (master = await downloadBuffer(supabase, "piece-derivatives", img.path)) : master);
  // What is already known costs nothing; new analysis or rendering waits for a
  // fresh invocation once this one's budget is spent.
  const outOfTime = () => Date.now() > renderUntil;

  let guess: Presentation | null = fresh ? row!.guess : null;
  let box: Box | null = null;
  let analysed: Analysed | undefined;
  if (!guess) {
    if (outOfTime()) return { kind: forced, squarePath: null, rendered: false, deferred: true };
    const buf = await load();
    if (!buf) return { kind: forced, squarePath: null, rendered: false, deferred: false };
    try {
      const a = await analysePhotograph(buf, { flatHint });
      // A room photograph is shown as taken; a studio shot is rendered; a
      // work cropped to its own edges is fitted on white.
      guess = a.scene ? "photo" : a.hasBackdrop ? "object" : "flat";
      box = a.box;
      analysed = a.analysed;
    } catch {
      return { kind: forced, squarePath: null, rendered: false, deferred: false };
    }
  }
  const kind = forced ?? guess;

  // Objects and room photographs both get a rendered tile; flat works are fitted by the site.
  const tiled = kind === "object" || kind === "photo";
  let squarePath = tiled && sameMaster && row!.kind === kind ? row!.square_path : null;
  let rendered = false;
  if (tiled && !squarePath) {
    if (outOfTime()) return { kind, squarePath: null, rendered, deferred: true };
    const buf = await load();
    if (!buf) return { kind: null, squarePath: null, rendered, deferred: false };
    let r: Awaited<ReturnType<typeof renderObjectSquare>>;
    try {
      r = kind === "photo" ? await renderPhotoSquare(buf, { flatHint, analysed }) : await renderObjectSquare(buf, { flatHint, analysed });
    } catch {
      return { kind: null, squarePath: null, rendered, deferred: false };
    }
    const path = `${piece.id}/${img.id}.sq-${r.sourceWidth}x${r.sourceHeight}.jpg`;
    const { error } = await supabase.storage
      .from("piece-derivatives")
      .upload(path, r.square, { contentType: "image/jpeg", upsert: true });
    if (error) {
      if (storageFailureIsPermanent(error)) return { kind: null, squarePath: null, rendered, deferred: false };
      throw new SyncRetryError(`Could not store the square tile ${path}: ${error.message}`);
    }
    squarePath = path;
    rendered = true;
    box = r.box;
  }

  if (!fresh || row!.kind !== kind || (row!.square_path ?? null) !== (squarePath ?? null)) {
    await supabase.from("piece_image_squares").upsert(
      {
        image_id: img.id,
        guess,
        kind,
        square_path: squarePath,
        source_width: img.width,
        source_height: img.height,
        flat_hint: flatHint,
        ...(box ? { box } : {}),
        rendered_at: new Date().toISOString(),
      },
      { onConflict: "image_id" },
    );
  }
  return { kind, squarePath, rendered, deferred: false };
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const presented = request.headers.get("x-sync-secret");
  if (!(await isAuthorised(supabase, presented))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const env = sanityEnv();
  if (!env) {
    return Response.json(
      { error: "Sanity env not configured (SANITY_PROJECT_ID / SANITY_API_WRITE_TOKEN)" },
      { status: 503 },
    );
  }

  // A database wake-up arrives on the first row of a burst (an autosave, a
  // bulk resync); wait a beat so the whole burst is in the outbox, then drain
  // it in batches until empty or the time budget is spent.
  if (request.headers.get("x-sync-source") === "outbox") await sleep(SETTLE_MS);

  const started = Date.now();
  const limits = { renderUntil: started + RENDER_BUDGET_MS, workUntil: started + WORK_BUDGET_MS };
  const totals = { processed: 0, held: 0, pieces: 0, makers: 0, lists: 0, runs: 0, deferred: 0, assetsDeleted: 0 };
  while (Date.now() - started < TIME_BUDGET_MS) {
    const r = await processBatch(supabase, env, limits);
    if (!r.ok) {
      return Response.json({ error: "sync batch failed", detail: r.detail, ...totals }, { status: 502 });
    }
    // Rows held back stay claimed, so the next batch takes other rows.
    if (r.claimed === 0) break;
    totals.processed += r.processed;
    totals.held += r.held;
    totals.pieces += r.pieces;
    totals.makers += r.makers;
    totals.lists += r.lists;
    totals.runs += 1;
    totals.deferred += r.deferred;
    totals.assetsDeleted += r.assetsDeleted;
    // Work left for later belongs to the next invocation (the queue wakes
    // one); draining on here would only overlap it.
    if (r.deferred > 0) break;
  }
  return Response.json(totals);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Two secrets open this route: SYNC_SHARED_SECRET (cron, Admin → Resync) and
 * the one the database presents from `sync_config` (the pg_net trigger). The
 * database one lives only in the database, so no environment change is
 * needed when the studio moves.
 */
async function isAuthorised(supabase: ReturnType<typeof createServiceClient>, presented: string | null) {
  if (!presented) return false;
  const envSecret = process.env.SYNC_SHARED_SECRET;
  if (envSecret && safeEqual(presented, envSecret)) return true;
  const { data } = await supabase.from("sync_config").select("secret").eq("id", 1).maybeSingle();
  return !!data?.secret && safeEqual(presented, data.secret as string);
}

type BatchResult =
  | {
      ok: true;
      /** Rows claimed; zero means the outbox is drained. */
      claimed: number;
      /** Rows finished (marked processed). */
      processed: number;
      /** Rows left unprocessed for a later run (a failed read or upload). */
      held: number;
      pieces: number;
      makers: number;
      lists: number;
      deferred: number;
      assetsDeleted: number;
    }
  | { ok: false; detail: string };

/**
 * When each of the batch's entities began to be held, as earlier runs
 * recorded it in sanity_sync_state (lib/sanity-sync-rules.ts, heldSince), for
 * HOLD_LIMIT_MS. An entity with no hold recorded is absent. Null when the
 * read fails: nothing then counts as held too long, and held entities leave
 * their records as they are.
 */
async function loadHoldStarts(supabase: Db, rows: OutboxRow[]): Promise<Map<string, number> | null> {
  const keys = new Set(rows.map((r) => entityKey(r.entity_type, r.entity_id)));
  try {
    const { data, error } = await supabase
      .from("sanity_sync_state")
      .select("entity_type, entity_id, error")
      .in("entity_id", [...new Set(rows.map((r) => r.entity_id))]);
    if (error) throw new Error(error.message);
    const at = new Map<string, number>();
    for (const r of (data ?? []) as { entity_type: string; entity_id: string; error: string | null }[]) {
      const key = entityKey(r.entity_type, r.entity_id);
      const since = keys.has(key) ? heldSince(r.error) : null;
      if (since !== null) at.set(key, since);
    }
    return at;
  } catch (e) {
    console.warn(`[sync] could not read when the held entities were first held: ${message(e)}`);
    return null;
  }
}

/**
 * Queue once more each entity this batch wrote that another run took a
 * later row for meanwhile (lib/sanity-sync-rules.ts, overlappedEntities), so
 * an older snapshot written last does not stay on the website. Best effort:
 * a failed check is logged and the entity's next edit pushes it again.
 */
async function requeueOverlapped(supabase: Db, rows: OutboxRow[], written: SyncEntity[]): Promise<number> {
  if (written.length === 0) return 0;
  const { data, error } = await supabase
    .from("sync_outbox")
    .select("id, entity_type, entity_id, claimed_at, processed_at")
    .in("entity_id", [...new Set(written.map((e) => e.id))])
    .gt("id", Math.min(...rows.map((r) => r.id)));
  if (error) {
    console.error(`[sync] could not check for an overlapping run: ${error.message}`);
    return 0;
  }
  const again = overlappedEntities(rows, (data ?? []) as Parameters<typeof overlappedEntities>[1], written);
  for (const e of again) {
    // Lists through their own queueing, which skips a row already waiting.
    const { error: queueErr } =
      e.type === "list"
        ? await supabase.rpc("queue_list_sync", { _list_id: e.id })
        : await supabase.from("sync_outbox").insert({ entity_type: e.type, entity_id: e.id, op: "upsert" });
    if (queueErr) console.error(`[sync] could not queue ${e.type} ${e.id} again after an overlapping run: ${queueErr.message}`);
  }
  return again.length;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function processBatch(
  supabase: ReturnType<typeof createServiceClient>,
  env: NonNullable<ReturnType<typeof sanityEnv>>,
  limits: {
    /** Square analysis and rendering run only before this time; later pieces are queued again. */
    renderUntil: number;
    /** A work's photographs are uploaded only before this time; a work not finished by then is queued again whole. */
    workUntil: number;
  },
): Promise<BatchResult> {
  // Claim rows (SKIP LOCKED) so an overlapping cron/webhook/resync run never
  // pushes the same row twice; a claim lapses after two minutes if the run
  // dies, and the next run picks the row up again.
  const { data: outbox, error } = await supabase.rpc("claim_sync_outbox", { batch: BATCH });
  if (error) return { ok: false, detail: error.message };
  if (!outbox || outbox.length === 0) {
    return { ok: true, claimed: 0, processed: 0, held: 0, pieces: 0, makers: 0, lists: 0, deferred: 0, assetsDeleted: 0 };
  }

  const rows = outbox as (OutboxRow & { op: string })[];
  const pieceIds = [...new Set(rows.filter((o) => o.entity_type === "piece").map((o) => o.entity_id))];
  const makerIds = [...new Set(rows.filter((o) => o.entity_type === "maker").map((o) => o.entity_id))];
  const listIds = [...new Set(rows.filter((o) => o.entity_type === "list").map((o) => o.entity_id))];

  // What happened to each entity; one with no entry was pushed as it stands.
  const outcomes = new Map<string, Outcome>();
  // A failed read or upload holds the entity back: nothing of it is written
  // and its rows stay claimed, so the claim lapses and a later run retries.
  const hold = (key: string, what: string, e: unknown) => {
    console.warn(`[sync] ${what} held back for a later run: ${message(e)}`);
    outcomes.set(key, { kind: "held", reason: message(e) });
  };
  // When each entity's hold began, as earlier runs recorded it: read once,
  // the first time a failure needs it. The clock starts at the first held
  // attempt, not at queueing, so a row that waited out an outage is still
  // held and retried on its first failure.
  let recordedHolds: Promise<Map<string, number> | null> | null = null;
  const holdStarts = () => (recordedHolds ??= loadHoldStarts(supabase, rows));
  const waitedTooLong = async (key: string) => heldTooLong((await holdStarts())?.get(key), Date.now());
  const holdClock = async () => ({
    // Read only when something is held: the records are not needed otherwise.
    since: [...outcomes.values()].some((o) => o.kind === "held") ? await holdStarts() : new Map<string, number>(),
    now: Date.now(),
  });
  // Images that would not upload, per entity, once it has been held too long
  // by earlier runs: it then goes out without them rather than keep coming back.
  const leftOut = new Map<string, string[]>();
  const orLeaveOut = async <T>(key: string, attempt: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await attempt();
    } catch (e) {
      if (!(e instanceof SyncRetryError) || !(await waitedTooLong(key))) throw e;
      leftOut.set(key, [...(leftOut.get(key) ?? []), e.message]);
      return fallback;
    }
  };
  const incomplete = (key: string) => {
    const missing = leftOut.get(key);
    if (!missing) return {};
    const n = missing.length;
    return { incomplete: `Published without ${n} image${n === 1 ? "" : "s"} that would not upload for ${HOLD_LIMIT_MS / 3_600_000} h: ${missing[0]}` };
  };

  /* ---- pieces ---------------------------------------------------------- */
  type PieceRow = PieceDimensions & {
    id: string;
    stock_number: string;
    title: string | null;
    medium: string | null;
    period: string | null;
    year: string | null;
    origin_region: string | null;
    description: string | null;
    status: string;
    web_visible: boolean;
    /** Set while the work is in the trash (soft delete); web_visible is left as it was. */
    deleted_at: string | null;
    presentation: string | null;
    maker_id: string | null;
    maker: { display_name: string; romanized_name: string | null; native_name: string | null; life_dates: string | null; web_visible: boolean } | null;
  };
  // A trashed work keeps web_visible so reinstating it republishes it, but it
  // must leave the website the moment it is trashed, not at the 30-day purge.
  // The pieces trigger queues the row on both edits; this decides the outcome.
  const pieceLive = (p: PieceRow | null) => !!p && p.web_visible && !p.deleted_at;
  // Trashed works drop out of the union view, so they resolve to no ref and
  // are read from `pieces` below (a trashed external work reads as missing,
  // which unpublishes it just the same).
  const refs = await resolvePieces(supabase, pieceIds);
  const pieces = new Map<string, PieceRow | null>();
  for (const pieceId of pieceIds) {
    const ref = refs.get(pieceId);
    const { data, error: pieceErr } = await supabase
      .from(ref?.table ?? "pieces")
      .select(
        `id, stock_number, title, medium, period, year, origin_region, description,
         ${DIMENSION_COLUMNS}, status, web_visible, deleted_at, presentation, maker_id,
         maker:makers(display_name, romanized_name, native_name, life_dates, web_visible)`,
      )
      .eq("id", pieceId)
      .maybeSingle();
    // A failed read must not be mistaken for "gone": leave the claim to lapse.
    if (pieceErr) return { ok: false, detail: pieceErr.message };
    pieces.set(pieceId, (data as unknown as PieceRow | null) ?? null);
  }

  const livePieceIds = [...pieces.entries()].filter(([, p]) => pieceLive(p)).map(([id]) => id);

  // Provenance: only entries marked public, oldest first, as one line each.
  const provenanceByPiece = new Map<string, string>();
  if (livePieceIds.length > 0) {
    const { data: prov, error: provErr } = await supabase
      .from("provenance_entries")
      .select("piece_id, date_text, party, details, sort_order")
      .in("piece_id", livePieceIds)
      .eq("is_public", true)
      .order("sort_order", { ascending: true });
    // A failed read would publish the works with no provenance: leave the claim to lapse.
    if (provErr) return { ok: false, detail: provErr.message };
    for (const row of prov ?? []) {
      const line = [row.party, row.date_text ? `(${row.date_text})` : null, row.details].filter(Boolean).join(" ");
      if (!line) continue;
      const prev = provenanceByPiece.get(row.piece_id);
      provenanceByPiece.set(row.piece_id, prev ? `${prev}; ${line}` : line);
    }
  }

  // Display masters for the live pieces, in sort order: views of the work
  // only. Backs, condition and document shots (labels, tickets, lot slips)
  // and "other" stay in the studio. The role and caption are staff notes and
  // the website reads neither, so they are not sent.
  const imagesByPiece = new Map<string, { id: string; path: string; width: number | null; height: number | null }[]>();
  if (livePieceIds.length > 0) {
    const { data: imgs, error: imgErr } = await supabase
      .from("piece_images")
      .select("id, piece_id, storage_path_display, sort_order, width, height")
      .in("piece_id", livePieceIds)
      .in("role", [...WEBSITE_IMAGE_ROLES])
      .not("storage_path_display", "is", null)
      .eq("processing_status", "done")
      .order("sort_order", { ascending: true });
    // Without its photographs a work would go out bare and the cleanup would
    // then delete its images from the website: leave the claim to lapse.
    if (imgErr) return { ok: false, detail: imgErr.message };
    for (const row of imgs ?? []) {
      const path = safeStoragePath(row.storage_path_display, displayMasterRule(row.piece_id, row.id));
      if (!path) {
        console.warn(`[sync] skipped image ${row.id}: storage path is not the worker's own`);
        continue;
      }
      const list = imagesByPiece.get(row.piece_id) ?? [];
      if (list.length < IMAGES_PER_WORK) list.push({ id: row.id, path, width: row.width, height: row.height });
      imagesByPiece.set(row.piece_id, list);
    }
  }

  // Each live piece's first photograph makes its square tile; what the sync
  // decided for that master before is kept, so analysis and rendering run once.
  const squareRows = new Map<string, SquareRow>();
  const firstImagePiece = new Map<string, string>();
  for (const [pieceId, list] of imagesByPiece) if (list[0]) firstImagePiece.set(list[0].id, pieceId);
  if (firstImagePiece.size > 0) {
    const { data, error: squaresErr } = await supabase
      .from("piece_image_squares")
      .select("image_id, guess, kind, square_path, source_width, source_height, flat_hint")
      .in("image_id", [...firstImagePiece.keys()]);
    // Read as none, every tile would be analysed, rendered and uploaded again.
    if (squaresErr) return { ok: false, detail: squaresErr.message };
    for (const row of (data ?? []) as SquareRow[]) {
      // A tile path that is not the sync's own is dropped, so the tile is rendered afresh.
      const pieceId = firstImagePiece.get(row.image_id) ?? "";
      const squarePath = row.square_path ? safeStoragePath(row.square_path, squareTileRule(pieceId, row.image_id)) : null;
      squareRows.set(row.image_id, { ...row, square_path: squarePath });
    }
  }

  /* ---- makers ---------------------------------------------------------- */
  type MakerRow = {
    id: string;
    display_name: string;
    romanized_name: string | null;
    native_name: string | null;
    life_dates: string | null;
    region: string | null;
    school_or_workshop: string | null;
    biography: string | null;
    profile_html: string | null;
    portrait_path: string | null;
    portrait_focus: PortraitFocus | null;
    web_visible: boolean;
  };
  const makers = new Map<string, MakerRow | null>();
  if (makerIds.length > 0) {
    const { data, error: makerErr } = await supabase
      .from("makers")
      .select("id, display_name, romanized_name, native_name, life_dates, region, school_or_workshop, biography, profile_html, portrait_path, portrait_focus, web_visible")
      .in("id", makerIds);
    // A failed read must not be mistaken for "gone" (that unpublishes the artist).
    if (makerErr) return { ok: false, detail: makerErr.message };
    for (const id of makerIds) {
      const m = ((data ?? []).find((r) => r.id === id) as MakerRow | undefined) ?? null;
      // A portrait outside the maker's own folder is not published.
      const portrait = m?.portrait_path ? safeStoragePath(m.portrait_path, portraitRule(m.id)) : null;
      if (m?.portrait_path && !portrait) console.warn(`[sync] skipped portrait of maker ${m.id}: storage path is not in its folder`);
      makers.set(id, m ? { ...m, portrait_path: portrait } : null);
    }
  }
  // Every maker has an artist page unless switched off in the studio.
  const makerPublished = (m: MakerRow | null) => !!m && m.web_visible;

  /* ---- assets ---------------------------------------------------------- */
  const assetKeys = [
    ...[...imagesByPiece.values()].flat().map((i) => `piece-derivatives/${i.path}`),
    ...[...squareRows.values()].filter((r) => r.square_path).map((r) => `piece-derivatives/${r.square_path}`),
    ...[...makers.values()].filter((m) => makerPublished(m) && m?.portrait_path).map((m) => `maker-portraits/${m!.portrait_path}`),
  ];
  // Read as empty, every image would be uploaded again (and the batch could
  // outlast the function on every retry): leave the claim to lapse instead.
  let assetCache: Map<string, string>;
  try {
    assetCache = await loadAssetCache(supabase, assetKeys);
  } catch (e) {
    return { ok: false, detail: message(e) };
  }
  // Every asset the new documents reference: in use, whatever else is found.
  const published = new Set<string>();

  const mutations: unknown[] = [];
  // Deletes go in their own calls: Sanity refuses to delete a document that a
  // strong reference still points at, and one such row must not wedge the
  // whole batch behind it.
  const deletes: { key: string; id: string }[] = [];

  // Artists first so the works' references resolve in the same transaction.
  for (const makerId of makerIds) {
    const key = entityKey("maker", makerId);
    const m = makers.get(makerId) ?? null;
    if (!makerPublished(m)) {
      deletes.push({ key, id: artistDocId(makerId) });
      continue;
    }
    try {
      const name = m!.romanized_name?.trim() || m!.display_name;
      const portraitPath = m!.portrait_path;
      const portraitAsset = portraitPath
        ? await orLeaveOut(key, () => ensureImageAsset(supabase, env, "maker-portraits", portraitPath, assetCache), null)
        : null;
      // Portraits uploaded before face detection existed get their focus here,
      // once; the makers trigger then queues one more pass that finds it set.
      let focus = m!.portrait_focus;
      if (portraitAsset && portraitPath && !focus) {
        focus = await detectFocusInStorage(supabase, "maker-portraits", portraitPath);
        if (focus) await supabase.from("makers").update({ portrait_focus: focus }).eq("id", makerId);
      }
      mutations.push({
        createOrReplace: {
          _id: artistDocId(makerId),
          _type: "artist",
          supabaseId: makerId,
          name,
          nameNative: m!.native_name,
          slug: { _type: "slug", current: slugify(name) || makerId.slice(0, 8) },
          lifeDates: m!.life_dates,
          country: m!.region,
          period: m!.school_or_workshop,
          bioShort: m!.biography,
          bioLong: htmlToText(m!.profile_html),
          portrait: portraitAsset
            ? { _type: "image", asset: { _type: "reference", _ref: portraitAsset }, ...sanityFraming(focus) }
            : null,
          hidden: false,
        },
      });
      if (portraitAsset) published.add(portraitAsset);
      outcomes.set(key, { kind: "pushed", ...incomplete(key) });
    } catch (e) {
      hold(key, `artist ${makerId}`, e);
    }
  }

  for (const pieceId of pieceIds) {
    const key = entityKey("piece", pieceId);
    const piece = pieces.get(pieceId) ?? null;
    const docId = workDocId(pieceId);
    if (!piece || !pieceLive(piece)) {
      deletes.push({ key, id: docId });
      continue;
    }
    const photos = imagesByPiece.get(pieceId) ?? [];
    // Past the work budget a work stops before its next upload; what is
    // already on Sanity costs nothing and still goes out.
    const outOfTime = (path: string) => Date.now() > limits.workUntil && !assetCache.has(`piece-derivatives/${path}`);
    try {
      const assets: string[] = [];
      const images: unknown[] = [];
      let unfinished = false;
      for (const img of photos) {
        if (outOfTime(img.path)) {
          unfinished = true;
          break;
        }
        const assetId = await orLeaveOut(key, () => ensureImageAsset(supabase, env, "piece-derivatives", img.path, assetCache), null);
        if (!assetId) continue;
        assets.push(assetId);
        images.push({
          _type: "image",
          _key: img.id.replace(/-/g, "").slice(0, 12),
          asset: { _type: "reference", _ref: assetId },
        });
      }
      // The square tile: decided from the first photograph (or forced on the piece).
      const first = photos[0];
      let presentation: Presentation | null = null;
      let tile: unknown = null;
      let tileDeferred = false;
      if (first && !unfinished) {
        const square = await orLeaveOut(
          key,
          () => ensureSquare(supabase, piece, first, squareRows.get(first.id) ?? null, limits.renderUntil),
          // The master would not download: decided as if it were missing.
          { kind: forcedPresentation(piece.presentation), squarePath: null, rendered: false, deferred: false },
        );
        presentation = square.kind;
        tileDeferred = square.deferred;
        const tilePath = square.squarePath;
        if (tilePath) {
          if (square.rendered) {
            // New pixels at a path the website may already hold: forget the old
            // asset (the table's trigger files it as retired, and the cleanup
            // below deletes it once the new tile has replaced it).
            const tileKey = `piece-derivatives/${tilePath}`;
            assetCache.delete(tileKey);
            await supabase.from("sanity_assets").delete().eq("storage_path", tileKey);
          }
          if (outOfTime(tilePath)) {
            unfinished = true;
          } else {
            const tileAssetId = await orLeaveOut(key, () => ensureImageAsset(supabase, env, "piece-derivatives", tilePath, assetCache), null);
            if (tileAssetId) {
              assets.push(tileAssetId);
              tile = { _type: "image", asset: { _type: "reference", _ref: tileAssetId } };
            }
          }
        }
      }
      if (unfinished) {
        // Nothing of it is written; a fresh invocation finishes it.
        outcomes.set(key, { kind: "deferred" });
        continue;
      }
      const maker = piece.maker;
      // A live work always makes its maker publishable, so the reference resolves.
      const artistLinked = !!piece.maker_id && !!maker;
      mutations.push({
        createOrReplace: {
          _id: docId,
          _type: "work",
          supabaseId: piece.id,
          stockNumber: piece.stock_number,
          title: piece.title ?? "Untitled",
          maker: maker?.romanized_name?.trim() || maker?.display_name || null,
          makerNative: maker?.native_name ?? null,
          makerLifeDates: maker?.life_dates ?? null,
          // Weak so an artist page can be withdrawn without the work blocking it.
          artist: artistLinked ? { _type: "reference", _ref: artistDocId(piece.maker_id!), _weak: true } : null,
          year: piece.year,
          medium: piece.medium,
          period: piece.period,
          originRegion: piece.origin_region,
          description: piece.description,
          provenance: provenanceByPiece.get(pieceId) ?? null,
          // Composed from the numeric cm fields — the Sanity field keeps its
          // name, but the verbatim legacy column no longer feeds it.
          dimensionsDisplay: formatDimensionsFullCm(piece),
          available: piece.status === "in_stock",
          priceDisplay: "POA",
          images,
          presentation,
          tile,
          slug: {
            _type: "slug",
            current: `${piece.stock_number.toLowerCase()}-${slugify(piece.title ?? "untitled", 60)}`,
          },
        },
      });
      for (const a of assets) published.add(a);
      // A tile left for later: the work goes back on the queue, and the next
      // invocation starts with a full render budget.
      outcomes.set(key, { kind: "pushed", requeue: tileDeferred, ...incomplete(key) });
    } catch (e) {
      hold(key, `work ${piece.stock_number}`, e);
    }
  }

  /* ---- lists ------------------------------------------------------------ */
  // An inventory list becomes a `workList` document holding references to its
  // web-visible works, so an event can show a whole list. Membership is
  // resolved here (live rules included) by the same resolver the studio uses.
  for (const listId of listIds) {
    const key = entityKey("list", listId);
    const { data: list, error: listErr } = await supabase
      .from("piece_lists")
      .select("id, name, description, is_dynamic, filter_rules, updated_at, web_visible")
      .eq("id", listId)
      .maybeSingle();
    if (listErr) return { ok: false, detail: listErr.message };
    // Deleted, or not marked for the website: the document goes.
    if (!list || !list.web_visible) {
      deletes.push({ key, id: listDocId(listId) });
      continue;
    }
    try {
      // Resolved web-visible-only, so the live-list cap applies after the
      // visibility filter; static members are then checked the same way.
      // Either read throws when it fails: the list then waits for a later
      // run instead of going out empty.
      const memberIds = await resolveListPieceIds(supabase, list as ListLike, { webVisibleOnly: true });
      const visible = await selectInChunks<{ id: string }>(memberIds, (chunk) =>
        supabase.from("vw_pieces_list").select("id").in("id", chunk).eq("web_visible", true),
      );
      const visibleSet = new Set(visible.map((r) => r.id));
      const ordered = memberIds.filter((id) => visibleSet.has(id));
      mutations.push({
        createOrReplace: {
          _id: listDocId(listId),
          _type: "workList",
          supabaseId: listId,
          name: list.name,
          description: list.description,
          isDynamic: Boolean(list.is_dynamic),
          workCount: ordered.length,
          works: ordered.map((pid) => ({
            _type: "reference",
            _key: pid.replace(/-/g, "").slice(0, 12),
            _ref: workDocId(pid),
            // Weak: a work may be withdrawn from the site before the list is re-pushed.
            _weak: true,
          })),
          updatedAt: list.updated_at,
        },
      });
      outcomes.set(key, { kind: "pushed" });
    } catch (e) {
      hold(key, `list ${listId}`, e);
    }
  }

  const docIdOf = (e: SyncEntity) => (e.type === "piece" ? workDocId(e.id) : e.type === "maker" ? artistDocId(e.id) : listDocId(e.id));

  const stateRow = (s: StateUpdate) => ({
    entity_type: s.type,
    entity_id: s.id,
    sanity_doc_id: docIdOf(s),
    status: s.status,
    error: s.error,
  });

  const result = await sanityMutate(env, mutations);
  if (!result.ok) {
    // A remembered asset that is gone from Sanity fails every retry the same
    // way; forget any such, so the retry uploads them again.
    await forgetMissingAssets(supabase, env, [...published]).catch((e) => console.error("[sync] could not check assets:", e));
    // Record the failure; the claim lapses and the next run retries the rows.
    // An entity being held keeps when its hold began.
    const state = failedWriteState(rows, outcomes, { since: await holdStarts(), now: Date.now() }, result.detail);
    if (state.length > 0) await supabase.from("sanity_sync_state").upsert(state.map(stateRow), { onConflict: "entity_type,entity_id" });
    return { ok: false, detail: result.detail };
  }

  // Deletes one by one: a document still strongly referenced from an event
  // (references saved before the schema made them weak) is refused on its
  // own, recorded against that entity, and does not hold up the rest. Any
  // other failure (a 429, a 5xx, the network) leaves the row for a retry, so
  // a withdrawn work cannot stay public on a passing error.
  for (const d of deletes) {
    const r = await sanityMutate(env, [{ delete: { id: d.id } }]).catch((e: unknown) => ({
      ok: false as const,
      status: 0,
      detail: message(e),
      referenced: false,
    }));
    if (r.ok) outcomes.set(d.key, { kind: "pushed" });
    else if (r.referenced) outcomes.set(d.key, { kind: "refused", reason: `Could not remove from the website (still referenced by an event?): ${r.detail}` });
    else hold(d.key, `removal of ${d.id}`, new Error(`Could not remove from the website (${r.status || "no answer"}): ${r.detail}`));
  }

  // Held back too long (earlier runs recorded a hold that began more than
  // HOLD_LIMIT_MS ago): recorded and finished, so it stops coming back. Its
  // next edit, or Admin → Resync, tries again. A first failure is always held.
  for (const [key, o] of outcomes) {
    if (o.kind === "held" && (await waitedTooLong(key))) {
      outcomes.set(key, { kind: "gave_up", reason: `Gave up after ${HOLD_LIMIT_MS / 3_600_000} h of failures: ${o.reason}` });
    }
  }

  let plan = settleBatch(rows, outcomes, await holdClock());
  // Work left for later goes back on the queue first: the insert wakes a fresh
  // invocation, and a work not started must not be lost if it fails.
  if (plan.requeue.length > 0) {
    const { error: queueErr } = await supabase
      .from("sync_outbox")
      .insert(plan.requeue.map((e) => ({ entity_type: e.type, entity_id: e.id, op: "upsert" })));
    if (queueErr) {
      console.error(`[sync] could not queue deferred work again: ${queueErr.message}`);
      for (const e of plan.requeue) {
        const key = entityKey(e.type, e.id);
        if (outcomes.get(key)?.kind === "deferred") outcomes.set(key, { kind: "held", reason: `could not be queued again: ${queueErr.message}` });
      }
      plan = settleBatch(rows, outcomes, await holdClock());
    }
  }

  const now = new Date().toISOString();
  if (plan.done.length > 0) {
    await supabase.from("sync_outbox").update({ processed_at: now }).in("id", plan.done);
  }
  // Two writes so each is uniform: an upsert sets a column missing from some
  // of its rows to null, and only a push moves last_pushed_at.
  const pushedState = plan.state.filter((s) => s.pushed).map((s) => ({ ...stateRow(s), last_pushed_at: now }));
  const otherState = plan.state.filter((s) => !s.pushed).map(stateRow);
  for (const batch of [pushedState, otherState]) {
    if (batch.length > 0) await supabase.from("sanity_sync_state").upsert(batch, { onConflict: "entity_type,entity_id" });
  }

  // Another run may have written a newer snapshot before this one landed.
  await requeueOverlapped(supabase, rows, plan.written);

  // The documents are written: the images the sync uploaded for these works
  // and artists that no document uses any more (a photo deleted, rotated,
  // re-rendered or not for the website, a work withdrawn, an artist switched
  // off) are deleted from Sanity, so they stop being public. Only for the
  // works and artists this run wrote: one held back or left for later still
  // has its old document, and new uploads no document uses yet. Best effort:
  // the documents are already right, and the hourly cleanup cron catches
  // anything left (api/cron/sanity-assets).
  let assetsDeleted = 0;
  const prefixes = plan.sweep
    .filter((e) => e.type !== "list" && isUuid(e.id))
    .map((e) => `${e.type === "piece" ? "piece-derivatives" : "maker-portraits"}/${e.id}/`);
  try {
    assetsDeleted = (await deleteUnusedAssets(supabase, env, prefixes, published)).deleted;
  } catch (e) {
    console.error("[sync] asset cleanup failed:", e);
  }
  return {
    ok: true,
    claimed: rows.length,
    processed: plan.done.length,
    held: rows.length - plan.done.length,
    pieces: pieceIds.length,
    makers: makerIds.length,
    lists: listIds.length,
    deferred: plan.requeue.length,
    assetsDeleted,
  };
}

/** Vercel cron entry point — drains any outbox rows pg_net missed. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!process.env.CRON_SECRET || !safeEqual(bearer, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return POST(
    new Request(request.url, {
      method: "POST",
      headers: { "x-sync-secret": process.env.SYNC_SHARED_SECRET ?? "" },
    }),
  );
}

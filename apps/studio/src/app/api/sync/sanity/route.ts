import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { resolvePieces } from "@/lib/piece-store";
import { resolveListPieceIds, type ListLike } from "@/lib/list-members";
import { selectInChunks } from "@/lib/chunk";
import { detectPortraitFocus, sanityFraming, type PortraitFocus } from "@/lib/face/focus";
import { analysePhotograph, flatWorkHint, renderObjectSquare, type Analysed, type Box } from "@/lib/squares";
import { DIMENSION_COLUMNS, formatDimensionsFullCm, type PieceDimensions } from "@jvb/db";
import {
  artistDocId,
  listDocId,
  ensureImageAsset,
  htmlToText,
  loadAssetCache,
  sanityEnv,
  sanityMutate,
  slugify,
  workDocId,
} from "@/lib/sanity-sync";

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
 * Supabase → Sanity sync (one way). Woken by the database the moment an
 * outbox row is written (pg_net trigger, migration 0074), by Admin → Resync,
 * and by a Vercel cron as the fallback drain. Pushes web-visible pieces as
 * read-only `work` documents with their display images, and makers as
 * `artist` documents (every maker, unless switched off); unpublishes
 * pieces and makers that are no longer web-visible.
 */
type Db = Parameters<typeof ensureImageAsset>[0];

/** Download a storage object and find the face in it; null when either fails. */
async function detectFocusInStorage(supabase: Db, bucket: string, path: string): Promise<PortraitFocus | null> {
  try {
    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error || !blob) return null;
    return await detectPortraitFocus(Buffer.from(await blob.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Download a storage object as a buffer; null when it is missing. */
async function downloadBuffer(supabase: Db, bucket: string, path: string): Promise<Buffer | null> {
  const { data: blob, error } = await supabase.storage.from(bucket).download(path);
  if (error || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

/** What the sync decided for a display master before (piece_image_squares). */
type SquareRow = {
  image_id: string;
  guess: "flat" | "object";
  kind: "flat" | "object";
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
 * decided (the master would not download), so the website keeps its crop.
 */
async function ensureSquare(
  supabase: Db,
  piece: { id: string; presentation: string | null; medium: string | null; title: string | null },
  img: { id: string; path: string; width: number | null; height: number | null },
  row: SquareRow | null,
  renderUntil: number,
): Promise<{ kind: "flat" | "object" | null; squarePath: string | null; rendered: boolean; deferred: boolean }> {
  const forced = piece.presentation === "flat" || piece.presentation === "object" ? piece.presentation : null;
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

  let guess: "flat" | "object" | null = fresh ? row!.guess : null;
  let box: Box | null = null;
  let analysed: Analysed | undefined;
  if (!guess) {
    if (outOfTime()) return { kind: forced, squarePath: null, rendered: false, deferred: true };
    const buf = await load();
    if (!buf) return { kind: forced, squarePath: null, rendered: false, deferred: false };
    try {
      const a = await analysePhotograph(buf, { flatHint });
      guess = a.hasBackdrop ? "object" : "flat";
      box = a.box;
      analysed = a.analysed;
    } catch {
      return { kind: forced, squarePath: null, rendered: false, deferred: false };
    }
  }
  const kind = forced ?? guess;

  let squarePath = kind === "object" && sameMaster && row!.kind === "object" ? row!.square_path : null;
  let rendered = false;
  if (kind === "object" && !squarePath) {
    if (outOfTime()) return { kind, squarePath: null, rendered, deferred: true };
    const buf = await load();
    if (!buf) return { kind: null, squarePath: null, rendered, deferred: false };
    try {
      const r = await renderObjectSquare(buf, { flatHint, analysed });
      const path = `${piece.id}/${img.id}.sq-${r.sourceWidth}x${r.sourceHeight}.jpg`;
      const { error } = await supabase.storage
        .from("piece-derivatives")
        .upload(path, r.square, { contentType: "image/jpeg", upsert: true });
      if (error) return { kind: null, squarePath: null, rendered, deferred: false };
      squarePath = path;
      rendered = true;
      box = r.box;
    } catch {
      return { kind: null, squarePath: null, rendered, deferred: false };
    }
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
  const renderUntil = started + RENDER_BUDGET_MS;
  const totals = { processed: 0, pieces: 0, makers: 0, lists: 0, runs: 0, deferred: 0 };
  while (Date.now() - started < TIME_BUDGET_MS) {
    const r = await processBatch(supabase, env, renderUntil);
    if (!r.ok) {
      return Response.json({ error: "sanity mutate failed", detail: r.detail, ...totals }, { status: 502 });
    }
    if (r.processed === 0) break;
    totals.processed += r.processed;
    totals.pieces += r.pieces;
    totals.makers += r.makers;
    totals.lists += r.lists;
    totals.runs += 1;
    totals.deferred += r.deferred;
    // Tiles left for later belong to the next invocation, not to this one.
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
  | { ok: true; processed: number; pieces: number; makers: number; lists: number; deferred: number }
  | { ok: false; detail: string };

async function processBatch(
  supabase: ReturnType<typeof createServiceClient>,
  env: NonNullable<ReturnType<typeof sanityEnv>>,
  /** Square analysis and rendering run only before this time; later pieces are queued again. */
  renderUntil: number,
): Promise<BatchResult> {
  // Claim rows (SKIP LOCKED) so an overlapping cron/webhook/resync run never
  // pushes the same row twice; a claim lapses after two minutes if the run
  // dies, and the next run picks the row up again.
  const { data: outbox, error } = await supabase.rpc("claim_sync_outbox", { batch: BATCH });
  if (error) return { ok: false, detail: error.message };
  if (!outbox || outbox.length === 0) return { ok: true, processed: 0, pieces: 0, makers: 0, lists: 0, deferred: 0 };

  const rows = outbox as { id: number; entity_type: string; entity_id: string; op: string }[];
  const pieceIds = [...new Set(rows.filter((o) => o.entity_type === "piece").map((o) => o.entity_id))];
  const makerIds = [...new Set(rows.filter((o) => o.entity_type === "maker").map((o) => o.entity_id))];
  const listIds = [...new Set(rows.filter((o) => o.entity_type === "list").map((o) => o.entity_id))];

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
    presentation: string | null;
    maker_id: string | null;
    maker: { display_name: string; romanized_name: string | null; native_name: string | null; life_dates: string | null; web_visible: boolean } | null;
  };
  const refs = await resolvePieces(supabase, pieceIds);
  const pieces = new Map<string, PieceRow | null>();
  for (const pieceId of pieceIds) {
    const ref = refs.get(pieceId);
    const { data, error: pieceErr } = await supabase
      .from(ref?.table ?? "pieces")
      .select(
        `id, stock_number, title, medium, period, year, origin_region, description,
         ${DIMENSION_COLUMNS}, status, web_visible, presentation, maker_id,
         maker:makers(display_name, romanized_name, native_name, life_dates, web_visible)`,
      )
      .eq("id", pieceId)
      .maybeSingle();
    // A failed read must not be mistaken for "gone": leave the claim to lapse.
    if (pieceErr) return { ok: false, detail: pieceErr.message };
    pieces.set(pieceId, (data as unknown as PieceRow | null) ?? null);
  }

  const livePieceIds = [...pieces.entries()].filter(([, p]) => p?.web_visible).map(([id]) => id);

  // Provenance: only entries marked public, oldest first, as one line each.
  const provenanceByPiece = new Map<string, string>();
  if (livePieceIds.length > 0) {
    const { data: prov } = await supabase
      .from("provenance_entries")
      .select("piece_id, date_text, party, details, sort_order")
      .in("piece_id", livePieceIds)
      .eq("is_public", true)
      .order("sort_order", { ascending: true });
    for (const row of prov ?? []) {
      const line = [row.party, row.date_text ? `(${row.date_text})` : null, row.details].filter(Boolean).join(" ");
      if (!line) continue;
      const prev = provenanceByPiece.get(row.piece_id);
      provenanceByPiece.set(row.piece_id, prev ? `${prev}; ${line}` : line);
    }
  }

  // Display masters for the live pieces, in sort order.
  const imagesByPiece = new Map<
    string,
    { id: string; path: string; caption: string | null; role: string; width: number | null; height: number | null }[]
  >();
  if (livePieceIds.length > 0) {
    const { data: imgs } = await supabase
      .from("piece_images")
      .select("id, piece_id, storage_path_display, caption, role, sort_order, width, height")
      .in("piece_id", livePieceIds)
      .not("storage_path_display", "is", null)
      .eq("processing_status", "done")
      .order("sort_order", { ascending: true });
    for (const row of imgs ?? []) {
      const list = imagesByPiece.get(row.piece_id) ?? [];
      if (list.length < IMAGES_PER_WORK) {
        list.push({ id: row.id, path: row.storage_path_display, caption: row.caption, role: row.role, width: row.width, height: row.height });
      }
      imagesByPiece.set(row.piece_id, list);
    }
  }

  // Each live piece's first photograph makes its square tile; what the sync
  // decided for that master before is kept, so analysis and rendering run once.
  const squareRows = new Map<string, SquareRow>();
  const firstImageIds = [...imagesByPiece.values()].map((l) => l[0]?.id).filter((id): id is string => !!id);
  if (firstImageIds.length > 0) {
    const { data } = await supabase
      .from("piece_image_squares")
      .select("image_id, guess, kind, square_path, source_width, source_height, flat_hint")
      .in("image_id", firstImageIds);
    for (const row of (data ?? []) as SquareRow[]) squareRows.set(row.image_id, row);
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
    const { data } = await supabase
      .from("makers")
      .select("id, display_name, romanized_name, native_name, life_dates, region, school_or_workshop, biography, profile_html, portrait_path, portrait_focus, web_visible")
      .in("id", makerIds);
    for (const id of makerIds) makers.set(id, ((data ?? []).find((m) => m.id === id) as MakerRow | undefined) ?? null);
  }
  // Every maker has an artist page unless switched off in the studio.
  const makerPublished = (m: MakerRow | null) => !!m && m.web_visible;

  /* ---- assets ---------------------------------------------------------- */
  const assetKeys = [
    ...[...imagesByPiece.values()].flat().map((i) => `piece-derivatives/${i.path}`),
    ...[...squareRows.values()].filter((r) => r.square_path).map((r) => `piece-derivatives/${r.square_path}`),
    ...[...makers.values()].filter((m) => makerPublished(m) && m?.portrait_path).map((m) => `maker-portraits/${m!.portrait_path}`),
  ];
  const assetCache = await loadAssetCache(supabase, assetKeys);

  const mutations: unknown[] = [];
  // Pieces whose square tile could not be made within this invocation's budget.
  const deferredPieceIds: string[] = [];
  // Deletes go in their own calls: Sanity refuses to delete a document that a
  // strong reference still points at, and one such row must not wedge the
  // whole batch behind it.
  const deletes: { delete: { id: string } }[] = [];

  // Artists first so the works' references resolve in the same transaction.
  for (const makerId of makerIds) {
    const m = makers.get(makerId) ?? null;
    if (!makerPublished(m)) {
      deletes.push({ delete: { id: artistDocId(makerId) } });
      continue;
    }
    const name = m!.romanized_name?.trim() || m!.display_name;
    const portraitAsset = m!.portrait_path
      ? await ensureImageAsset(supabase, env, "maker-portraits", m!.portrait_path, assetCache)
      : null;
    // Portraits uploaded before face detection existed get their focus here,
    // once; the makers trigger then queues one more pass that finds it set.
    let focus = m!.portrait_focus;
    if (portraitAsset && m!.portrait_path && !focus) {
      focus = await detectFocusInStorage(supabase, "maker-portraits", m!.portrait_path);
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
  }

  for (const pieceId of pieceIds) {
    const piece = pieces.get(pieceId) ?? null;
    const docId = workDocId(pieceId);
    if (!piece || !piece.web_visible) {
      deletes.push({ delete: { id: docId } });
      continue;
    }
    const images: unknown[] = [];
    for (const img of imagesByPiece.get(pieceId) ?? []) {
      const assetId = await ensureImageAsset(supabase, env, "piece-derivatives", img.path, assetCache);
      if (!assetId) continue;
      images.push({
        _type: "image",
        _key: img.id.replace(/-/g, "").slice(0, 12),
        asset: { _type: "reference", _ref: assetId },
        caption: img.caption,
        role: img.role,
      });
    }
    // The square tile: decided from the first photograph (or forced on the piece).
    const first = (imagesByPiece.get(pieceId) ?? [])[0];
    let presentation: "flat" | "object" | null = null;
    let tile: unknown = null;
    if (first) {
      const square = await ensureSquare(supabase, piece, first, squareRows.get(first.id) ?? null, renderUntil);
      presentation = square.kind;
      if (square.deferred) deferredPieceIds.push(pieceId);
      if (square.squarePath) {
        if (square.rendered) {
          // New pixels at a path the website may already hold: forget the old asset.
          const key = `piece-derivatives/${square.squarePath}`;
          assetCache.delete(key);
          await supabase.from("sanity_assets").delete().eq("storage_path", key);
        }
        const tileAssetId = await ensureImageAsset(supabase, env, "piece-derivatives", square.squarePath, assetCache);
        if (tileAssetId) tile = { _type: "image", asset: { _type: "reference", _ref: tileAssetId } };
      }
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
  }

  /* ---- lists ------------------------------------------------------------ */
  // An inventory list becomes a `workList` document holding references to its
  // web-visible works, so an event can show a whole list. Membership is
  // resolved here (live rules included) by the same resolver the studio uses.
  for (const listId of listIds) {
    const { data: list, error: listErr } = await supabase
      .from("piece_lists")
      .select("id, name, description, is_dynamic, filter_rules, updated_at, web_visible")
      .eq("id", listId)
      .maybeSingle();
    if (listErr) return { ok: false, detail: listErr.message };
    // Deleted, or not marked for the website: the document goes.
    if (!list || !list.web_visible) {
      deletes.push({ delete: { id: listDocId(listId) } });
      continue;
    }
    // Resolved web-visible-only, so the live-list cap applies after the
    // visibility filter; static members are then checked the same way.
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
  }

  const result = await sanityMutate(env, mutations);
  const stateRows = [
    ...pieceIds.map((id) => ({ entity_type: "piece", entity_id: id, sanity_doc_id: workDocId(id) })),
    ...makerIds.map((id) => ({ entity_type: "maker", entity_id: id, sanity_doc_id: artistDocId(id) })),
    ...listIds.map((id) => ({ entity_type: "list", entity_id: id, sanity_doc_id: listDocId(id) })),
  ];

  if (!result.ok) {
    // Record the failure; the claim lapses and the next run retries the rows.
    await supabase.from("sanity_sync_state").upsert(
      stateRows.map((r) => ({ ...r, status: "error", error: result.detail })),
      { onConflict: "entity_type,entity_id" },
    );
    return { ok: false, detail: result.detail };
  }

  // Deletes one by one: a document still strongly referenced from an event
  // (references saved before the schema made them weak) fails on its own,
  // is recorded as an error against that entity, and does not hold up the rest.
  const deleteErrors = new Map<string, string>();
  for (const d of deletes) {
    const r = await sanityMutate(env, [d]);
    if (!r.ok) deleteErrors.set(d.delete.id, r.detail);
  }

  const now = new Date().toISOString();
  await supabase
    .from("sync_outbox")
    .update({ processed_at: now })
    .in("id", rows.map((o) => o.id));
  await supabase.from("sanity_sync_state").upsert(
    stateRows.map((r) =>
      deleteErrors.has(r.sanity_doc_id)
        ? { ...r, status: "error", error: `Could not remove from the website (still referenced by an event?): ${deleteErrors.get(r.sanity_doc_id)}` }
        : { ...r, status: "ok", error: null, last_pushed_at: now },
    ),
    { onConflict: "entity_type,entity_id" },
  );

  // A piece whose tile had to wait goes back on the queue; the insert wakes the
  // sync again, and that invocation starts with a full render budget.
  if (deferredPieceIds.length > 0) {
    await supabase.from("sync_outbox").insert(deferredPieceIds.map((id) => ({ entity_type: "piece", entity_id: id, op: "upsert" })));
  }
  return { ok: true, processed: rows.length, pieces: pieceIds.length, makers: makerIds.length, lists: listIds.length, deferred: deferredPieceIds.length };
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

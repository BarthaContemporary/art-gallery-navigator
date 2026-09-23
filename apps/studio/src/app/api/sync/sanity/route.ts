import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { resolvePieces } from "@/lib/piece-store";
import { DIMENSION_COLUMNS, formatDimensionsFullCm, type PieceDimensions } from "@jvb/db";
import {
  artistDocId,
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
 * Supabase → Sanity sync (one way). Woken by the database the moment an
 * outbox row is written (pg_net trigger, migration 0074), by Admin → Resync,
 * and by a Vercel cron as the fallback drain. Pushes web-visible pieces as
 * read-only `work` documents with their display images, and makers as
 * `artist` documents; unpublishes pieces and makers that are no longer
 * web-visible.
 */
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
  const totals = { processed: 0, pieces: 0, makers: 0, runs: 0 };
  while (Date.now() - started < TIME_BUDGET_MS) {
    const r = await processBatch(supabase, env);
    if (!r.ok) {
      return Response.json({ error: "sanity mutate failed", detail: r.detail, ...totals }, { status: 502 });
    }
    if (r.processed === 0) break;
    totals.processed += r.processed;
    totals.pieces += r.pieces;
    totals.makers += r.makers;
    totals.runs += 1;
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
  | { ok: true; processed: number; pieces: number; makers: number }
  | { ok: false; detail: string };

async function processBatch(
  supabase: ReturnType<typeof createServiceClient>,
  env: NonNullable<ReturnType<typeof sanityEnv>>,
): Promise<BatchResult> {
  // Claim rows (SKIP LOCKED) so an overlapping cron/webhook/resync run never
  // pushes the same row twice; a claim lapses after two minutes if the run
  // dies, and the next run picks the row up again.
  const { data: outbox, error } = await supabase.rpc("claim_sync_outbox", { batch: BATCH });
  if (error) return { ok: false, detail: error.message };
  if (!outbox || outbox.length === 0) return { ok: true, processed: 0, pieces: 0, makers: 0 };

  const rows = outbox as { id: number; entity_type: string; entity_id: string; op: string }[];
  const pieceIds = [...new Set(rows.filter((o) => o.entity_type === "piece").map((o) => o.entity_id))];
  const makerIds = [...new Set(rows.filter((o) => o.entity_type === "maker").map((o) => o.entity_id))];

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
    maker_id: string | null;
    maker: { display_name: string; romanized_name: string | null; native_name: string | null; life_dates: string | null; web_visible: boolean } | null;
  };
  const refs = await resolvePieces(supabase, pieceIds);
  const pieces = new Map<string, PieceRow | null>();
  for (const pieceId of pieceIds) {
    const ref = refs.get(pieceId);
    const { data } = await supabase
      .from(ref?.table ?? "pieces")
      .select(
        `id, stock_number, title, medium, period, year, origin_region, description,
         ${DIMENSION_COLUMNS}, status, web_visible, maker_id,
         maker:makers(display_name, romanized_name, native_name, life_dates, web_visible)`,
      )
      .eq("id", pieceId)
      .maybeSingle();
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
  const imagesByPiece = new Map<string, { id: string; path: string; caption: string | null; role: string }[]>();
  if (livePieceIds.length > 0) {
    const { data: imgs } = await supabase
      .from("piece_images")
      .select("id, piece_id, storage_path_display, caption, role, sort_order")
      .in("piece_id", livePieceIds)
      .not("storage_path_display", "is", null)
      .eq("processing_status", "done")
      .order("sort_order", { ascending: true });
    for (const row of imgs ?? []) {
      const list = imagesByPiece.get(row.piece_id) ?? [];
      if (list.length < IMAGES_PER_WORK) {
        list.push({ id: row.id, path: row.storage_path_display, caption: row.caption, role: row.role });
      }
      imagesByPiece.set(row.piece_id, list);
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
    web_visible: boolean;
  };
  const makers = new Map<string, MakerRow | null>();
  if (makerIds.length > 0) {
    const { data } = await supabase
      .from("makers")
      .select("id, display_name, romanized_name, native_name, life_dates, region, school_or_workshop, biography, profile_html, portrait_path, web_visible")
      .in("id", makerIds);
    for (const id of makerIds) makers.set(id, ((data ?? []).find((m) => m.id === id) as MakerRow | undefined) ?? null);
  }
  // A maker is published when flagged, or when any of its works is on the site.
  const makersWithLiveWork = new Set<string>();
  if (makerIds.length > 0) {
    for (const table of ["pieces", "external_pieces"] as const) {
      const { data } = await supabase
        .from(table)
        .select("maker_id")
        .in("maker_id", makerIds)
        .eq("web_visible", true)
        .is("deleted_at", null);
      for (const r of data ?? []) if (r.maker_id) makersWithLiveWork.add(r.maker_id);
    }
  }
  const makerPublished = (m: MakerRow | null) => !!m && (m.web_visible || makersWithLiveWork.has(m.id));

  /* ---- assets ---------------------------------------------------------- */
  const assetKeys = [
    ...[...imagesByPiece.values()].flat().map((i) => `piece-derivatives/${i.path}`),
    ...[...makers.values()].filter((m) => makerPublished(m) && m?.portrait_path).map((m) => `maker-portraits/${m!.portrait_path}`),
  ];
  const assetCache = await loadAssetCache(supabase, assetKeys);

  const mutations: unknown[] = [];

  // Artists first so the works' references resolve in the same transaction.
  for (const makerId of makerIds) {
    const m = makers.get(makerId) ?? null;
    if (!makerPublished(m)) {
      mutations.push({ delete: { id: artistDocId(makerId) } });
      continue;
    }
    const name = m!.romanized_name?.trim() || m!.display_name;
    const portraitAsset = m!.portrait_path
      ? await ensureImageAsset(supabase, env, "maker-portraits", m!.portrait_path, assetCache)
      : null;
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
        portrait: portraitAsset ? { _type: "image", asset: { _type: "reference", _ref: portraitAsset } } : null,
        hidden: false,
      },
    });
  }

  for (const pieceId of pieceIds) {
    const piece = pieces.get(pieceId) ?? null;
    const docId = workDocId(pieceId);
    if (!piece || !piece.web_visible) {
      mutations.push({ delete: { id: docId } });
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
        slug: {
          _type: "slug",
          current: `${piece.stock_number.toLowerCase()}-${slugify(piece.title ?? "untitled", 60)}`,
        },
      },
    });
  }

  const result = await sanityMutate(env, mutations);
  const stateRows = [
    ...pieceIds.map((id) => ({ entity_type: "piece", entity_id: id, sanity_doc_id: workDocId(id) })),
    ...makerIds.map((id) => ({ entity_type: "maker", entity_id: id, sanity_doc_id: artistDocId(id) })),
  ];

  if (!result.ok) {
    // Record the failure; the claim lapses and the next run retries the rows.
    await supabase.from("sanity_sync_state").upsert(
      stateRows.map((r) => ({ ...r, status: "error", error: result.detail })),
      { onConflict: "entity_type,entity_id" },
    );
    return { ok: false, detail: result.detail };
  }

  const now = new Date().toISOString();
  await supabase
    .from("sync_outbox")
    .update({ processed_at: now })
    .in("id", rows.map((o) => o.id));
  await supabase.from("sanity_sync_state").upsert(
    stateRows.map((r) => ({ ...r, status: "ok", error: null, last_pushed_at: now })),
    { onConflict: "entity_type,entity_id" },
  );

  return { ok: true, processed: rows.length, pieces: pieceIds.length, makers: makerIds.length };
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

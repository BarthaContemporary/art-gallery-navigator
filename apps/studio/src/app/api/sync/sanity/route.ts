import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

/**
 * Supabase → Sanity sync. Called by pg_net on outbox insert and by a Vercel
 * cron (fallback drain). Pushes web-visible pieces as read-only `work`
 * documents; unpublishes pieces that are no longer web-visible.
 */
export async function POST(request: Request) {
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!secret || !safeEqual(request.headers.get("x-sync-secret"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? "production";
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !token) {
    return Response.json(
      { error: "Sanity env not configured (SANITY_PROJECT_ID / SANITY_API_WRITE_TOKEN)" },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  const { data: outbox, error } = await supabase
    .from("sync_outbox")
    .select("id, entity_type, entity_id, op")
    .is("processed_at", null)
    .order("id")
    .limit(25);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!outbox || outbox.length === 0) return Response.json({ processed: 0 });

  const mutations: unknown[] = [];
  const pieceIds = [...new Set(outbox.map((o) => o.entity_id))];

  for (const pieceId of pieceIds) {
    const { data: piece } = await supabase
      .from("pieces")
      .select(
        `id, stock_number, title, medium, period, origin_region, description,
         dimensions_display, height_cm, width_cm, depth_cm, length_cm, status, web_visible,
         maker:makers(display_name, life_dates)`,
      )
      .eq("id", pieceId)
      .maybeSingle();

    const docId = `work-${pieceId}`;
    if (!piece || !piece.web_visible) {
      mutations.push({ delete: { id: docId } });
      continue;
    }
    const maker = piece.maker as unknown as { display_name: string; life_dates: string | null } | null;
    mutations.push({
      createOrReplace: {
        _id: docId,
        _type: "work",
        supabaseId: piece.id,
        stockNumber: piece.stock_number,
        title: piece.title ?? "Untitled",
        maker: maker?.display_name ?? null,
        makerLifeDates: maker?.life_dates ?? null,
        medium: piece.medium,
        period: piece.period,
        originRegion: piece.origin_region,
        description: piece.description,
        dimensionsDisplay: piece.dimensions_display,
        available: piece.status === "in_stock",
        priceDisplay: "POA",
        slug: {
          _type: "slug",
          current: `${piece.stock_number.toLowerCase()}-${(piece.title ?? "untitled")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            .slice(0, 60)}`,
        },
      },
    });
  }

  const res = await fetch(
    `https://${projectId}.api.sanity.io/v2026-07-01/data/mutate/${dataset}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mutations }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    // record failure against sync state, leave outbox unprocessed for retry
    await supabase.from("sanity_sync_state").upsert(
      pieceIds.map((id) => ({
        entity_type: "piece",
        entity_id: id,
        status: "error",
        error: body.slice(0, 500),
      })),
      { onConflict: "entity_type,entity_id" },
    );
    return Response.json({ error: "sanity mutate failed", detail: body }, { status: 502 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("sync_outbox")
    .update({ processed_at: now })
    .in("id", outbox.map((o) => o.id));
  await supabase.from("sanity_sync_state").upsert(
    pieceIds.map((id) => ({
      entity_type: "piece",
      entity_id: id,
      sanity_doc_id: `work-${id}`,
      status: "ok",
      error: null,
      last_pushed_at: now,
    })),
    { onConflict: "entity_type,entity_id" },
  );

  return Response.json({ processed: outbox.length, pieces: pieceIds.length });
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

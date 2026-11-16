import { NextResponse } from "next/server";
import { getSupabase, createServiceClient, requireCapture } from "@/lib/supabase";
import { pushBatch } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Every photo is copied inside this request. lib/push.ts claims each work for
// LEASE_MINUTES (10), longer than this, so a run the platform cuts off is
// resumed by the next push rather than overlapped.
export const maxDuration = 300;

/**
 * Promote a capture batch's draft works into real inventory pieces, each
 * flagged `needs_completion`. Photos are routed through the normal image
 * pipeline; a linked invoice is attached as a purchase-invoice document and
 * prefills the purchase date / cost. Safe to repeat: see lib/push.ts.
 */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { batchId } = (await req.json().catch(() => ({}))) as { batchId?: unknown };
  if (typeof batchId !== "string" || !batchId) return NextResponse.json({ error: "Missing batch" }, { status: 400 });

  // Reads honour RLS (admin/staff); writes use the service client so the
  // financials table (no staff policy) and cross-bucket copies always succeed.
  const rls = await getSupabase();
  const db = createServiceClient();

  try {
    const out = await pushBatch({ rls: rls as unknown as typeof db, db, batchId, userId: gate.session.user.id });
    if (!out.found) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    return NextResponse.json({ results: out.results, closed: out.closed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Push failed" }, { status: 500 });
  }
}

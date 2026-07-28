import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { resolveSource } from "@/lib/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a purchase-session batch, stamping the date + resolved location. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json().catch(() => ({}))) as {
    lat?: number;
    lng?: number;
    accuracy?: number;
  };

  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;

  const resolved =
    lat != null && lng != null
      ? await resolveSource(lat, lng)
      : { source_name: null, source_address: null, source_type: null };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_batches")
    .insert({
      created_by: gate.session.user.id,
      geo_lat: lat,
      geo_lng: lng,
      geo_accuracy: typeof body.accuracy === "number" ? body.accuracy : null,
      source_name: resolved.source_name,
      source_address: resolved.source_address,
      source_type: resolved.source_type,
    })
    .select("id, captured_at, source_name, source_address, source_type, ledger")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data });
}

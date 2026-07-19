import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a new invoice, optionally tied to a purchase batch. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { batchId } = (await req.json().catch(() => ({}))) as { batchId?: string };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_invoices")
    .insert({ created_by: gate.session.user.id, batch_id: batchId ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

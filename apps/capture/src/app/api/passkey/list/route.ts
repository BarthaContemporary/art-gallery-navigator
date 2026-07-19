import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List the signed-in user's registered passkeys (RLS scopes to self). */
export async function GET() {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("passkeys")
    .select("id, device_label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return NextResponse.json({ passkeys: data ?? [] });
}

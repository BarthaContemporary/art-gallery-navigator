import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List the signed-in user's registered passkeys. RLS also shows an admin
 * everyone's, so the list is narrowed to the user's own: everyone's are on
 * the studio's Admin page, with their owners' names.
 */
export async function GET() {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("passkeys")
    .select("id, device_label, created_at, last_used_at")
    .eq("user_id", gate.session.user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ passkeys: data ?? [] });
}

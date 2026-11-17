import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remove one of the signed-in user's own passkeys. RLS lets an admin see
 * everyone's, so the delete is narrowed to the user's own (everyone's are on
 * the studio's Admin page), and a passkey that was not removed answers 404
 * rather than ok.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("passkeys")
    .delete()
    .eq("id", id)
    .eq("user_id", gate.session.user.id)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "That passkey was not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

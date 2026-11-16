import { NextResponse } from "next/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";
import { contactDeleteRefusal, holdRefusal } from "@/lib/contact-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Undo a contact just added in the capture app (a mistaken scan, a
 * duplicate). lib/contact-rules.ts says which: only the app's own, only
 * recent ones, and never one with records under a legal hold. Everything
 * else is an erasure, done in the studio by an admin through erase_contact().
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const db = createServiceClient();
  const { data: contact } = await db
    .from("crm_contacts")
    .select("id, tags, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const refused = contactDeleteRefusal(contact);
  if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });

  // The service role may run this before and after migration 0093 (which
  // takes it away from signed-in users).
  const { data: holds, error: holdErr } = await db.rpc("contact_legal_holds", { _contact: id });
  const held = holdRefusal(holds, Boolean(holdErr));
  if (held) return NextResponse.json({ error: held.error, holds: held.holds }, { status: held.status });

  const { error } = await db.from("crm_contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

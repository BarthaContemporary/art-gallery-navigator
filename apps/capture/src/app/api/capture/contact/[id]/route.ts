import { NextResponse } from "next/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delete a contact added via the capture app. Uses the service client so it
 * works regardless of per-role CRM delete policies; guarded to capture users
 * and restricted to contacts this app created (tagged 'capture').
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;

  const db = createServiceClient();
  const { data: contact } = await db
    .from("crm_contacts")
    .select("id, tags")
    .eq("id", id)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!((contact.tags ?? []) as string[]).includes("capture"))
    return NextResponse.json({ error: "Only capture-added contacts can be deleted here" }, { status: 403 });

  const { error } = await db.from("crm_contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

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

  // A card that has since become a buyer, seller, consignor or a client
  // with due diligence on file is under a legal hold: deleting it would wipe
  // those records (the database refuses it too, from migration 0097).
  const { data: holds, error: holdsErr } = await db.rpc("contact_legal_holds", { _contact: id });
  if (holdsErr) return NextResponse.json({ error: `Could not check the contact: ${holdsErr.message}` }, { status: 500 });
  if (Array.isArray(holds) && holds.length > 0)
    return NextResponse.json(
      { error: `This contact can’t be deleted here: ${holds.join("; ")}. Ask an admin to erase it in the studio.` },
      { status: 409 },
    );

  const { error } = await db.from("crm_contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "23503" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

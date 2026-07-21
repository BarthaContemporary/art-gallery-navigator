import { NextResponse } from "next/server";
import { getSupabase, getSession } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partial update for a shipment's own details (date / reference / notes /
 * destination country) so the shipment editor — import, temporary import,
 * export and temporary export — can autosave like the inventory editor.
 * Destination country only applies to (temporary) exports; it is ignored for
 * imports.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await getSupabase();

  // Confirm the shipment exists (and get its kind so we only store a
  // destination on export-type shipments).
  const { data: shipment } = await supabase
    .from("shipments")
    .select("kind")
    .eq("id", id)
    .maybeSingle();
  if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const str = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };
  const isExport = shipment.kind === "export" || shipment.kind === "temporary_export";

  const update: Record<string, string | null> = {
    shipment_date: str("shipment_date"),
    reference: str("reference"),
    notes: str("notes"),
  };
  if (isExport) update.destination_country = str("destination_country");

  const { error } = await supabase.from("shipments").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

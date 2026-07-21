import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * On-demand overview for one work in the stock book: the import + export
 * shipment records (which carry the documents) so the accountant can jump
 * straight to them. Loaded when a row is expanded.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const piece = new URL(req.url).searchParams.get("piece");
  if (!piece) return NextResponse.json({ error: "Missing piece" }, { status: 400 });

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("piece_shipments")
    .select("kind, shipment:shipments ( id, shipment_date, reference, destination_country )")
    .eq("piece_id", piece)
    .in("kind", ["import", "export"]);

  const out: {
    import: { id: string; shipment_date: string | null; reference: string | null } | null;
    export: { id: string; shipment_date: string | null; reference: string | null; destination_country: string | null } | null;
  } = { import: null, export: null };

  for (const r of (data ?? []) as unknown as {
    kind: string;
    shipment: { id: string; shipment_date: string | null; reference: string | null; destination_country: string | null } | null;
  }[]) {
    if (!r.shipment) continue;
    if (r.kind === "import") out.import = r.shipment;
    else if (r.kind === "export") out.export = r.shipment;
  }

  return NextResponse.json(out);
}

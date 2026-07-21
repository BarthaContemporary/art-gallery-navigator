import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Doc = { title: string; url: string };
type Ship = {
  id: string;
  shipment_date: string | null;
  reference: string | null;
  destination_country: string | null;
  documents: Doc[];
};

/**
 * On-demand overview for one work in the stock book: the import + export
 * shipment records and signed URLs for every document attached to them, so the
 * accountant can open all related import / export documents in new tabs.
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

  const rows = (data ?? []) as unknown as {
    kind: string;
    shipment: { id: string; shipment_date: string | null; reference: string | null; destination_country: string | null } | null;
  }[];

  // Collect the import / export shipments, then their documents in one query.
  const byKind: Record<"import" | "export", Ship | null> = { import: null, export: null };
  const ids: string[] = [];
  for (const r of rows) {
    if (!r.shipment) continue;
    if (r.kind !== "import" && r.kind !== "export") continue;
    byKind[r.kind] = { ...r.shipment, documents: [] };
    ids.push(r.shipment.id);
  }

  if (ids.length) {
    const { data: docs } = await supabase
      .from("shipment_documents")
      .select("shipment_id, title, storage_path")
      .in("shipment_id", ids)
      .order("created_at");
    const docRows = (docs ?? []) as { shipment_id: string; title: string | null; storage_path: string }[];
    if (docRows.length) {
      const { data: signed } = await supabase.storage
        .from("piece-documents")
        .createSignedUrls(docRows.map((d) => d.storage_path), 600);
      (signed ?? []).forEach((s, i) => {
        const dr = docRows[i];
        if (!s.signedUrl || !dr) return;
        const target =
          byKind.import?.id === dr.shipment_id
            ? byKind.import
            : byKind.export?.id === dr.shipment_id
              ? byKind.export
              : null;
        target?.documents.push({ title: dr.title ?? "Document", url: s.signedUrl });
      });
    }
  }

  return NextResponse.json({ import: byKind.import, export: byKind.export });
}

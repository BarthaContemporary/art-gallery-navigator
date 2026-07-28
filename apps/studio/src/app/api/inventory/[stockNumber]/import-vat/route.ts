import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_TYPES = new Set(["import_vat_paid", "import_vat_deferred", "temporary_import"]);

/** Save the import type + import VAT paid onto piece_financials (admin/acct). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stockNumber: string }> },
) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeFinancials(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = await getSupabase();
  const piece = await resolvePiece(supabase, stockNumber);
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const rawType = String(fd.get("import_type") ?? "").trim();
  const importType = IMPORT_TYPES.has(rawType) ? rawType : null;
  const vatRaw = String(fd.get("import_vat_gbp") ?? "").trim();
  const importVat = importType === "import_vat_paid" && vatRaw !== "" ? Number(vatRaw) : null;
  if (importVat !== null && (!Number.isFinite(importVat) || importVat < 0)) {
    return NextResponse.json({ error: "Import VAT must be a positive amount." }, { status: 400 });
  }

  const { error } = await supabase
    .from("piece_financials")
    .update({ import_type: importType, import_vat_gbp: importVat })
    .eq("piece_id", piece.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { readAmount } from "@/lib/amount";
import { NextResponse } from "next/server";
import { getSupabase, getSession, canWriteFinancials } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_TYPES = new Set(["import_vat_paid", "import_vat_deferred", "temporary_import"]);

/**
 * Save the import type + import VAT paid onto piece_financials. Admin only:
 * the accountant reads the figures but row security gives that role no
 * write, so the update would match no row and look saved.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stockNumber: string }> },
) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteFinancials(session.roles)) {
    return NextResponse.json({ error: "Only an administrator can change the import VAT." }, { status: 403 });
  }

  const supabase = await getSupabase();
  const piece = await resolvePiece(supabase, stockNumber);
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const rawType = String(fd.get("import_type") ?? "").trim();
  const importType = IMPORT_TYPES.has(rawType) ? rawType : null;
  const vat = importType === "import_vat_paid" ? readAmount(fd.get("import_vat_gbp")) : { value: null, invalid: false };
  const importVat = vat.value;
  if (importVat !== null && (!Number.isFinite(importVat) || importVat < 0)) {
    return NextResponse.json({ error: "Import VAT must be a positive amount." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("piece_financials")
    // Something typed that is not an amount leaves the stored figure alone.
    .update(vat.invalid ? { import_type: importType } : { import_type: importType, import_vat_gbp: importVat })
    .eq("piece_id", piece.id)
    .select("piece_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "The import VAT could not be saved for this record. Reload the page and try again." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}

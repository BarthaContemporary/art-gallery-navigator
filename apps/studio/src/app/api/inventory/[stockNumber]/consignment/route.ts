import { NextResponse } from "next/server";
import { getSupabase, getSession } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partial update for the Consignment panel only (kept separate from the main
 * inventory PATCH so it can live in its own autosaving section on the edit
 * page, below Temporary exports).
 *   co_owner_consignee   -> pieces.shares_note
 *   consignment_details  -> pieces.consignment_details
 *   consignment_share_pct (0 < x < 100)
 *   sale_handled_by_jvb  ("yes" | "no" | "")
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stockNumber: string }> },
) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await getSupabase();
  const fd = await req.formData();
  const str = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t || null;
  };

  // Share / commission: optional, but if present must be strictly 0–100.
  const pctRaw = String(fd.get("consignment_share_pct") ?? "").trim();
  let pct: number | null = null;
  if (pctRaw !== "") {
    const n = Number(pctRaw);
    if (!Number.isFinite(n) || n <= 0 || n >= 100) {
      return NextResponse.json(
        { error: "Share / commission must be more than 0 and less than 100." },
        { status: 400 },
      );
    }
    pct = n;
  }

  const handled = String(fd.get("sale_handled_by_jvb") ?? "").trim();
  const saleHandled = handled === "yes" ? true : handled === "no" ? false : null;

  const { error } = await supabase
    .from("pieces")
    .update({
      shares_note: str("co_owner_consignee"),
      consignee_contact_id: str("consignee_contact_id"),
      consignment_details: str("consignment_details"),
      consignment_share_pct: pct,
      sale_handled_by_jvb: saleHandled,
      updated_by: session.user.id,
    })
    .eq("stock_number", stockNumber);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getSupabase, getSession, canSeeFinancials } from "@/lib/supabase";
import { currencyCode, isIsoDate, londonToday, spotRateToGbp } from "@/lib/fx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The spot GBP rate the record's save would use for a sale: the editor shows
 * the Sold £ from this, so it shows what the save stores (the same cache and
 * the same rule for a provisional rate), and the browser never builds the
 * rate service's URL from what is in the form.
 *
 * GET ?currency=EUR&date=2026-11-02 → { rate: number | null }
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSeeFinancials(session.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const currency = currencyCode(url.searchParams.get("currency"));
  const date = url.searchParams.get("date");
  if (!currency) return NextResponse.json({ rate: null });
  if (currency !== "GBP" && !isIsoDate(date)) return NextResponse.json({ rate: null });

  const supabase = await getSupabase();
  const rate = await spotRateToGbp(supabase, currency, date, londonToday());
  return NextResponse.json({ rate });
}

import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["collector", "museum", "press"]);

/**
 * Nationality breakdown of CRM contacts by their primary address country,
 * optionally filtered to a single contact type. Returns slices sorted by
 * count with a rolled-up "Other" tail so the pie stays legible.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "all";
  const supabase = await getSupabase();

  let query = supabase.from("crm_contacts").select("country").limit(10000);
  if (TYPES.has(type)) query = query.eq("contact_type", type);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  let total = 0;
  for (const row of (data ?? []) as { country: string | null }[]) {
    const country = (row.country ?? "").trim() || "Unknown";
    counts.set(country, (counts.get(country) ?? 0) + 1);
    total += 1;
  }

  const sorted = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Keep the top 8; roll the rest into "Other".
  const TOP = 8;
  let slices = sorted;
  if (sorted.length > TOP) {
    const head = sorted.slice(0, TOP);
    const tail = sorted.slice(TOP).reduce((s, x) => s + x.count, 0);
    slices = [...head, { label: "Other", count: tail }];
  }

  return NextResponse.json({ total, slices });
}

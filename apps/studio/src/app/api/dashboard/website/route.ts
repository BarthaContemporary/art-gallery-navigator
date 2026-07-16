import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";
import { plausibleConfig, fetchTimeseries } from "@/lib/plausible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS: Record<string, number> = { month: 30, quarter: 91, year: 365 };
const RANGE: Record<string, string> = { month: "30d", quarter: "91d", year: "365d" };

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Website panel series: visitors + pageviews (Plausible) + enquiries (DB). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = new URL(req.url).searchParams.get("period") ?? "month";
  const days = DAYS[period] ?? 30;
  const start = new Date(Date.now() - days * 86_400_000);

  // Daily axis start..today so the chart always renders, even without Plausible.
  const axis: string[] = [];
  for (let i = 0; i <= days; i++) {
    axis.push(dayKey(new Date(start.getTime() + i * 86_400_000)));
  }

  // Plausible visitors + pageviews (optional).
  const cfg = plausibleConfig();
  const visitorsByDay = new Map<string, number>();
  const pageviewsByDay = new Map<string, number>();
  if (cfg) {
    const ts = await fetchTimeseries(cfg, RANGE[period] ?? "30d");
    for (const p of ts ?? []) {
      visitorsByDay.set(p.date, p.visitors);
      pageviewsByDay.set(p.date, p.pageviews);
    }
  }

  // Enquiries per day from the DB.
  const supabase = await getSupabase();
  const { data: enq } = await supabase
    .from("enquiries")
    .select("created_at")
    .gte("created_at", start.toISOString());
  const enquiriesByDay = new Map<string, number>();
  for (const e of enq ?? []) {
    const k = String((e as { created_at: string }).created_at).slice(0, 10);
    enquiriesByDay.set(k, (enquiriesByDay.get(k) ?? 0) + 1);
  }

  const series = axis.map((date) => ({
    date,
    visitors: visitorsByDay.get(date) ?? 0,
    pageviews: pageviewsByDay.get(date) ?? 0,
    enquiries: enquiriesByDay.get(date) ?? 0,
  }));

  return NextResponse.json({ series, plausible: Boolean(cfg) });
}

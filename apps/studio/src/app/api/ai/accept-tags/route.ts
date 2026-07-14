import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Append reviewed AI hashtags to a piece's tags[] (deduped). */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let stock: string;
  let tags: string[];
  try {
    const body = (await req.json()) as { stock?: string; tags?: string[] };
    stock = String(body.stock ?? "").trim();
    tags = (body.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!stock || tags.length === 0)
    return NextResponse.json({ error: "Missing stock or tags" }, { status: 400 });

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, tags")
    .eq("stock_number", stock)
    .maybeSingle();
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = ((piece as { tags: string[] | null }).tags ?? []).map((t) =>
    t.toLowerCase(),
  );
  const merged = [
    ...((piece as { tags: string[] | null }).tags ?? []),
    ...tags.filter((t) => !existing.includes(t.toLowerCase())),
  ];

  const { error } = await supabase
    .from("pieces")
    .update({ tags: merged })
    .eq("id", (piece as { id: string }).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tags: merged });
}

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a new category (used by the inline "add category" picker). */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let name = "";
  try {
    const body = (await req.json()) as { name?: string };
    name = String(body.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Reuse an existing category with the same name (case-insensitive) rather
  // than creating a duplicate.
  const { data: existing } = await supabase
    .from("categories")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ category: { id: existing.id, label: existing.name } });
  }

  // The categories table requires a unique `code`; derive one from the name.
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "CAT";

  let code = base;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from("categories")
      .select("id")
      .eq("code", code)
      .limit(1)
      .maybeSingle();
    if (!clash) break;
    code = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ code, name })
    .select("id, name")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ category: { id: data.id, label: data.name } });
}

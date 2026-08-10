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
    .select("id, name, is_active")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    // 20260713000021 hid every category that came in from FileMaker and
    // re-activated only six, so a name typed here is often already on file as
    // a hidden row — Lacquer among them. Handing that row back untouched
    // looked like nothing happened: no category was created, and the one that
    // matched stayed out of every picker and filter. Asking for a category by
    // name is asking for it to be available, so reuse un-hides it.
    if (existing.is_active === false) {
      const { data: shown, error: actErr } = await supabase
        .from("categories")
        .update({ is_active: true })
        .eq("id", existing.id)
        .select("id");
      if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });
      if (!shown?.length)
        return NextResponse.json(
          { error: `“${existing.name}” exists but is hidden, and you don’t have permission to show it.` },
          { status: 403 },
        );
    }
    return NextResponse.json({ category: { id: existing.id, label: existing.name }, reused: true });
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

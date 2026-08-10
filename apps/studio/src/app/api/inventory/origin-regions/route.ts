import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a new origin/region option (used by the inline "add region" picker). */
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
  if (name.length > 100) return NextResponse.json({ error: "Name too long" }, { status: 400 });

  // Same trap as the category picker: a region that already exists but has
  // been hidden would be silently left hidden by an ignore-duplicates upsert,
  // so the region asked for still appears in no dropdown. Reuse un-hides it.
  const { data: existing } = await supabase
    .from("origin_regions")
    .select("id, name, is_active")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.is_active === false) {
      const { data: shown, error: actErr } = await supabase
        .from("origin_regions")
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
    return NextResponse.json({ name: existing.name });
  }

  const { error } = await supabase.from("origin_regions").insert({ name });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ name });
}

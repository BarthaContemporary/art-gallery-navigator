import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a new area of interest to the shared master list (crm_interest_areas). */
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

  // Insert; if it already exists, return the existing row.
  const { data, error } = await supabase
    .from("crm_interest_areas")
    .upsert({ name }, { onConflict: "name" })
    .select("id, name, list_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ensure the area has a real mailing list backing it (auto-created).
  //
  // Dynamic, matching this area's name against the contact's own
  // custom_fields.interests — the same shape migration 0060 gave the existing
  // areas. A static list here would never gain a member: nothing mirrors
  // interests into crm_list_members any more, so it would sit at zero forever.
  const area = data as { id: string; name: string; list_id: string | null };
  if (area && !area.list_id) {
    const { data: list } = await supabase
      .from("crm_lists")
      .insert({
        name: area.name,
        description: "Area of interest (auto)",
        is_dynamic: true,
        filter_rules: { interest: area.name },
      })
      .select("id")
      .single();
    if (list?.id) {
      await supabase.from("crm_interest_areas").update({ list_id: list.id }).eq("id", area.id);
    }
  }

  return NextResponse.json({ area: { id: area.id, name: area.name } });
}

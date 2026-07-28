import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a maker from the inline "add maker" picker on a work.
 *
 * Basic information only — display name, plus optional life dates and native
 * name. Everything else (biography, portrait, school) is filled in later on the
 * maker's own page; this exists so cataloguing a work never has to stop because
 * the maker doesn't exist yet.
 *
 * Mirrors /api/inventory/categories: an existing maker with the same display
 * name is reused rather than duplicated, since a second "Shomin" would quietly
 * split that maker's works in two.
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { display_name?: string; life_dates?: string; native_name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const displayName = String(body.display_name ?? "").trim().slice(0, 200);
  if (!displayName) return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const lifeDates = String(body.life_dates ?? "").trim().slice(0, 100) || null;
  const nativeName = String(body.native_name ?? "").trim().slice(0, 200) || null;

  // Reuse an existing maker with the same name rather than creating a twin.
  const { data: existing } = await supabase
    .from("makers")
    .select("id, display_name, life_dates")
    .ilike("display_name", displayName)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      maker: {
        id: existing.id,
        label: existing.life_dates
          ? `${existing.display_name} (${existing.life_dates})`
          : existing.display_name,
      },
      reused: true,
    });
  }

  const { data: created, error } = await supabase
    .from("makers")
    .insert({
      display_name: displayName,
      life_dates: lifeDates,
      native_name: nativeName,
    })
    .select("id, display_name, life_dates")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Could not add maker" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    maker: {
      id: created.id,
      label: created.life_dates
        ? `${created.display_name} (${created.life_dates})`
        : created.display_name,
    },
  });
}

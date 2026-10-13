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
 * split that maker's works in two. The response says `reused: true` so the
 * picker can tell the user which maker the work was linked to.
 *
 * Life dates are what tell two makers of one name apart, as on the /makers
 * page: typed dates that differ from every dated same-name maker create a new
 * one; matching dates, or none typed, reuse the existing maker, and so does a
 * same-name maker with no dates on file (typing dates is not a sign of a
 * different person). Only `separate: true`, sent by the picker's "Add a
 * separate maker instead", creates a second maker of the same name on purpose.
 */
export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { display_name?: string; life_dates?: string; native_name?: string; separate?: boolean };
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
  // ilike gives the case-insensitive match, but % and _ in a name would act as
  // wildcards (and PostgREST reads * as % too), so they are escaped and the
  // candidates are then compared exactly.
  const pattern = displayName.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: candidates } = await supabase
    .from("makers")
    .select("id, display_name, life_dates")
    .ilike("display_name", pattern)
    .limit(20);
  const sameName = (candidates ?? []).filter(
    (m) => m.display_name.trim().toLowerCase() === displayName.toLowerCase(),
  );
  // "1850 - 1920" and "1850–1920" are the same dates.
  const datesKey = (d: string | null | undefined) =>
    d?.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, "").toLowerCase() || null;
  const key = datesKey(lifeDates);
  const sameDates = sameName.find((m) => datesKey(m.life_dates) === key);
  const existing =
    body.separate === true
      ? key
        ? sameDates
        : undefined
      : (sameDates ??
        sameName.find((m) => datesKey(m.life_dates) === null) ??
        (key === null ? sameName[0] : undefined));
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

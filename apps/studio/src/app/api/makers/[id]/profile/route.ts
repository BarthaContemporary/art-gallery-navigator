import { NextResponse } from "next/server";
import { getSupabase, getSession } from "@/lib/supabase";
import { sanitizeHtml } from "@/lib/sanitize-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partial update for the maker editing panel: rich profile HTML and/or the
 * maker detail fields — whatever the body carries is saved.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    html?: string;
    fields?: Record<string, string>;
  };

  const update: Record<string, string | null> = {};
  if (typeof body.html === "string") {
    if (body.html.length > 200_000)
      return NextResponse.json({ error: "Profile too long" }, { status: 400 });
    update.profile_html = sanitizeHtml(body.html);
  }
  if (body.fields && typeof body.fields === "object") {
    const allowed = ["display_name", "native_name", "romanized_name", "life_dates", "region", "school_or_workshop"];
    for (const k of allowed) {
      if (typeof body.fields[k] === "string") update[k] = body.fields[k].trim() || null;
    }
    // A maker must keep a display name.
    if ("display_name" in update && !update.display_name)
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const supabase = await getSupabase();
  // Select the updated row back. An update the caller isn't permitted to make
  // is filtered out by RLS rather than rejected — no error, no rows changed —
  // and the editor would show "Saved ✓" over an edit that never landed.
  const { data, error } = await supabase.from("makers").update(update).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length)
    return NextResponse.json({ error: "Maker not found, or not yours to edit" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

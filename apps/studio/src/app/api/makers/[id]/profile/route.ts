import { NextResponse } from "next/server";
import { getSupabase, getSession } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Very small allow-list-ish sanitiser for the maker profile HTML produced by
 * the studio's editor: strips script/style/iframe blocks, event handlers and
 * javascript: URLs. The editor only emits p/br/b/strong/i/em/u/h2/h3/ul/ol/li,
 * but sanitise anyway — this HTML later feeds PDFs and the public website.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "");
}

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
  const { error } = await supabase.from("makers").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

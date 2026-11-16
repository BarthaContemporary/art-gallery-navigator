import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { compileNewsletter, type NewsletterDesign } from "@/lib/newsletter";
import { GALLERY_NAME, GALLERY_ADDRESS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Autosave endpoint for the newsletter designer. Accepts the campaign fields
 * plus the block design, recompiles the email-safe HTML server-side (so the
 * stored body_html always matches the design), and persists everything.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: {
    name?: string;
    subject?: string;
    preview_text?: string;
    from_address?: string;
    list_id?: string | null;
    design?: NewsletterDesign;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cap = (s: string, n: number) => s.slice(0, n);
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = cap(body.name.trim(), 200) || "Untitled newsletter";
  if (typeof body.subject === "string") patch.subject = cap(body.subject, 300);
  if (typeof body.preview_text === "string") patch.preview_text = cap(body.preview_text, 300);
  if (typeof body.from_address === "string")
    patch.from_address = cap(body.from_address.trim(), 320) || null;
  if ("list_id" in body) patch.list_id = body.list_id || null;
  if (body.design && Array.isArray(body.design.blocks)) {
    patch.design = body.design;
    patch.body_html = compileNewsletter(body.design, {
      galleryName: GALLERY_NAME,
      galleryAddress: GALLERY_ADDRESS,
      previewText: typeof body.preview_text === "string" ? body.preview_text : undefined,
    });
  }

  // Once a send has started (status sending, partial or sent), only the name
  // may change: the rest must reach those still to be mailed exactly as it
  // reached the others, and each email's idempotency key is derived from it.
  // The designer locks these fields; this is the server-side guard.
  let locked = false;
  const contentKeys = () => Object.keys(patch).some((k) => k !== "name");
  const nameOnly = () => {
    for (const k of Object.keys(patch)) if (k !== "name") delete patch[k];
  };
  const notFound = () => NextResponse.json({ error: "Newsletter not found, or not yours to edit" }, { status: 404 });
  if (contentKeys()) {
    const { data: current, error: readErr } = await supabase
      .from("crm_campaigns")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!current) return notFound();
    if (current.status !== "draft") {
      locked = true;
      nameOnly();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, locked });
  }

  // The content is written only while the row is still a draft, in the same
  // statement: a send that claims the newsletter between the read above and
  // this write must not have its design changed under it. Each write asks
  // for its row back, so one that matched nothing is not answered as saved.
  if (contentKeys()) {
    const { data, error } = await supabase
      .from("crm_campaigns")
      .update(patch)
      .eq("id", id)
      .eq("status", "draft")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data?.length) return NextResponse.json({ ok: true, locked, savedAt: new Date().toISOString() });
    // No draft matched: a send claimed it meanwhile (keep only the name, as
    // above), or it is gone or not this user's to edit.
    const { data: now, error: rereadErr } = await supabase
      .from("crm_campaigns")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (rereadErr) return NextResponse.json({ error: rereadErr.message }, { status: 500 });
    if (!now || now.status === "draft") return notFound();
    locked = true;
    nameOnly();
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, unchanged: true, locked });
  }

  // Name only (allowed at any status).
  const { data, error } = await supabase.from("crm_campaigns").update(patch).eq("id", id).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) return notFound();
  return NextResponse.json({ ok: true, locked, savedAt: new Date().toISOString() });
}

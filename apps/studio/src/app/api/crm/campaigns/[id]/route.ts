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

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim() || "Untitled newsletter";
  if (typeof body.subject === "string") patch.subject = body.subject;
  if (typeof body.preview_text === "string") patch.preview_text = body.preview_text;
  if (typeof body.from_address === "string")
    patch.from_address = body.from_address.trim() || null;
  if ("list_id" in body) patch.list_id = body.list_id || null;
  if (body.design && Array.isArray(body.design.blocks)) {
    patch.design = body.design;
    patch.body_html = compileNewsletter(body.design, {
      galleryName: GALLERY_NAME,
      galleryAddress: GALLERY_ADDRESS,
      previewText: typeof body.preview_text === "string" ? body.preview_text : undefined,
    });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error } = await supabase.from("crm_campaigns").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

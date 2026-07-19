import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Record an uploaded invoice page; return a preview URL. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: invoiceId } = await params;
  const body = (await req.json().catch(() => ({}))) as { path?: string; pageNo?: number };
  if (!body.path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_invoice_pages")
    .insert({ invoice_id: invoiceId, storage_path: body.path, page_no: body.pageNo ?? 1 })
    .select("id, page_no")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: signed } = await supabase.storage.from("captures").createSignedUrl(body.path, 60 * 60);
  return NextResponse.json({ page: data, url: signed?.signedUrl ?? null });
}

/** Attach the squared-up version the browser produced for a page. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  await params;
  const body = (await req.json().catch(() => ({}))) as { pageId?: string; squaredPath?: string };
  if (!body.pageId || !body.squaredPath)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("capture_invoice_pages")
    .update({ squared_path: body.squaredPath })
    .eq("id", body.pageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

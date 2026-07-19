import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Record a photo that the browser has just uploaded, return a preview URL. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id: workId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    path?: string;
    batchId?: string;
    width?: number;
    height?: number;
    sortOrder?: number;
  };
  if (!body.path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("capture_photos")
    .insert({
      work_id: workId,
      batch_id: body.batchId ?? null,
      storage_path: body.path,
      width: body.width ?? null,
      height: body.height ?? null,
      sort_order: body.sortOrder ?? 0,
    })
    .select("id, storage_path, is_label")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: signed } = await supabase.storage
    .from("captures")
    .createSignedUrl(body.path, 60 * 60);

  return NextResponse.json({ photo: data, url: signed?.signedUrl ?? null });
}

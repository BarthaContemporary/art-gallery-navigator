import { NextResponse } from "next/server";
import { getSession, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Upload / replace a maker's representative portrait. Multipart form with a
 * single `file`. Stored in the private maker-portraits bucket (service client —
 * the bucket has no user policies) as <makerId>/portrait.<ext>.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "Not an image" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Image too large (max 15MB)" }, { status: 400 });

  const svc = createServiceClient();
  const { data: maker } = await svc.from("makers").select("id").eq("id", id).maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${id}/portrait.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from("maker-portraits")
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await svc.from("makers").update({ portrait_path: path }).eq("id", id);
  const { data: signed } = await svc.storage.from("maker-portraits").createSignedUrl(path, 3600);
  return NextResponse.json({ ok: true, path, url: signed?.signedUrl ?? null });
}

/** Remove the portrait. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: maker } = await svc.from("makers").select("portrait_path").eq("id", id).maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (maker.portrait_path) await svc.storage.from("maker-portraits").remove([maker.portrait_path]);
  await svc.from("makers").update({ portrait_path: null }).eq("id", id);
  return NextResponse.json({ ok: true });
}

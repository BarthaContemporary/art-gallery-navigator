import { NextResponse } from "next/server";
import { getSession, createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * First leg of the portrait upload: hand the browser a signed URL so the
 * original goes DIRECTLY to storage. Vercel API routes cap request bodies at
 * 4.5MB, so full-resolution originals must never travel through a route —
 * same pattern as the artwork image pipeline.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ext: rawExt } = ((await req.json().catch(() => ({}))) ?? {}) as { ext?: string };
  const ext = String(rawExt ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  const svc = createServiceClient();
  const { data: maker } = await svc.from("makers").select("id").eq("id", id).maybeSingle();
  if (!maker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = `${id}/original-${Date.now()}.${ext}`;
  const { data, error } = await svc.storage.from("maker-portraits").createSignedUploadUrl(path);
  if (error || !data)
    return NextResponse.json({ error: error?.message ?? "Could not sign upload" }, { status: 500 });
  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
}

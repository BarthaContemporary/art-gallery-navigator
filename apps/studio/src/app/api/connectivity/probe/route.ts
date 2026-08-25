import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/supabase";
import { createServiceClient } from "@jvb/db/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Support for the /connectivity self-test page. Issues signed upload URLs for
 * throwaway probe objects and deletes them afterwards. The page runs in the
 * browser of whoever is having trouble, so the tests traverse THEIR network —
 * the whole point. Session required; probe objects are confined to a
 * _diagnostics/conn- prefix and are removed by the cleanup call.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; paths?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const service = createServiceClient();

  if (body.action === "sign") {
    const path = `_diagnostics/conn-${randomUUID()}.bin`;
    const { data, error } = await service.storage
      .from("piece-documents")
      .createSignedUploadUrl(path);
    if (error || !data)
      return NextResponse.json({ error: error?.message ?? "Could not sign" }, { status: 500 });
    return NextResponse.json({ path, signedUrl: data.signedUrl });
  }

  if (body.action === "cleanup") {
    const paths = (body.paths ?? []).filter(
      (p) => typeof p === "string" && /^_diagnostics\/conn-[0-9a-f-]{36}\.bin$/.test(p),
    );
    if (paths.length > 0) await service.storage.from("piece-documents").remove(paths);
    return NextResponse.json({ ok: true, removed: paths.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

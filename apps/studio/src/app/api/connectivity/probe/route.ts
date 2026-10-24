import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession, hasRole } from "@/lib/supabase";
import { rateLimit } from "@jvb/db/rate-limit";
import { createServiceClient } from "@jvb/db/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Support for the /connectivity self-test page. Issues signed upload URLs for
 * throwaway probe objects and deletes them afterwards. The page runs in the
 * browser of whoever is having trouble, so the tests traverse THEIR network —
 * the whole point. Admin or staff only (the roles that may write to the
 * documents bucket), at most 60 probe uploads an hour per person; probe
 * objects are confined to a _diagnostics/conn- prefix and are removed by the
 * cleanup call.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The service client below writes into the documents bucket, which only
  // admin and staff may write to (security review: role before service role).
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "The connection test is for admin and staff accounts" }, { status: 403 });

  let body: { action?: string; paths?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const service = createServiceClient();

  if (body.action === "sign") {
    if (!(await rateLimit(service, `connectivity:user:${session.user.id}`, 3600, 60)))
      return NextResponse.json({ error: "That is enough test uploads for this hour" }, { status: 429 });
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

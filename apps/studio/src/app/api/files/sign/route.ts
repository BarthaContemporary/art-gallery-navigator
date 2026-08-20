import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabase, getSession } from "@/lib/supabase";
import { createServiceClient } from "@jvb/db/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 1 of the document upload flow: issue a signed storage upload URL.
 *
 * Documents used to be uploaded straight from the browser with the browser
 * client's own access token. That token dies whenever the session family is
 * revoked — which the auth audit log shows happening most days (stale tabs
 * and suspended devices replaying old refresh tokens) — so uploads failed
 * "intermittently" while autosave, which rides the session cookie through
 * API routes, never did. This route puts uploads on the same cookie-authed
 * path: the signed URL it returns lets the browser PUT the file with no
 * token at all, exactly as the image uploader has always worked.
 *
 * The route decides the object key itself. The client only names a scope and
 * a record; it cannot choose an arbitrary path in the bucket.
 */

const SCOPES = new Set(["shipment", "piece", "document"]);
const EXT = new Set(["pdf", "jpg", "jpeg", "png", "tif", "tiff", "doc", "docx", "heic", "heif"]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { scope?: string; recordId?: string; filename?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const scope = String(body.scope ?? "");
  if (!SCOPES.has(scope)) return NextResponse.json({ error: "Unknown scope" }, { status: 400 });

  const rawExt = String(body.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  const ext = EXT.has(rawExt) ? rawExt : "bin";

  const supabase = await getSupabase();
  const id = randomUUID();
  let path: string;

  if (scope === "document") {
    // Standalone shared document — the object id becomes the row id at commit.
    path = `documents/${id}.${ext}`;
  } else {
    const recordId = String(body.recordId ?? "");
    if (!/^[0-9a-f-]{36}$/.test(recordId))
      return NextResponse.json({ error: "Missing record" }, { status: 400 });
    // The record must exist and be visible to this user (RLS applies).
    const table = scope === "shipment" ? "shipments" : "vw_pieces_all";
    const { data: rec } = await supabase.from(table).select("id").eq("id", recordId).maybeSingle();
    if (!rec) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    path = scope === "shipment" ? `shipments/${recordId}/${id}.${ext}` : `${recordId}/${id}.${ext}`;
  }

  // Service client: the signed URL is the capability; the path above is ours.
  const { data, error } = await createServiceClient()
    .storage.from("piece-documents")
    .createSignedUploadUrl(path);
  if (error || !data)
    return NextResponse.json({ error: error?.message ?? "Could not sign upload" }, { status: 500 });

  return NextResponse.json({ path, signedUrl: data.signedUrl });
}

import { NextResponse } from "next/server";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { createServiceClient } from "@jvb/db/server";
import { isMissingFunction } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step 2 of the document upload flow: record the uploaded file.
 *
 * Runs on the session cookie like every other API route, so it works whenever
 * autosave works. Inserts through the user's own RLS client — the staff
 * invoice boundary and every other policy apply exactly as they did when the
 * browser wrote the row itself. If the insert is refused, the uploaded object
 * is deleted again, so a failure can no longer strand a file in the bucket
 * with no row pointing at it.
 *
 * That delete runs with the service role, which no storage policy limits, so
 * it may only ever touch the file this user's own sign request created
 * (security review 2026-10, F2): commit first claims the path's
 * pending_uploads record — issued by /api/files/sign to this user, for this
 * record, used once — and refuses any path a document row already points at.
 * Without both, a staff user could name an existing invoice's path, let the
 * insert fail, and have the route destroy the invoice file.
 */

type Body = {
  scope?: string;
  recordId?: string;
  path?: string;
  title?: string;
  docType?: string;
  reference?: string;
  docDate?: string;
};

type Service = ReturnType<typeof createServiceClient>;

/** The object key must be one this scope's sign step could have issued. */
function pathPattern(scope: string, recordId: string): RegExp | null {
  const uuid = "[0-9a-f-]{36}";
  const ext = "[a-z0-9]{1,5}";
  if (scope === "shipment") return new RegExp(`^shipments/${recordId}/${uuid}\\.${ext}$`);
  if (scope === "piece") return new RegExp(`^${recordId}/${uuid}\\.${ext}$`);
  if (scope === "document") return new RegExp(`^documents/${uuid}\\.${ext}$`);
  return null;
}

/**
 * Whether any document row already points at this object. Asked with the
 * service role: the staff policies hide invoice rows, and an invoice is
 * exactly the file this must never hand over.
 */
async function pathInUse(service: Service, path: string): Promise<boolean> {
  const [pieceDocs, shipmentDocs] = await Promise.all([
    service.from("piece_documents").select("id", { count: "exact", head: true }).eq("storage_path", path),
    service.from("shipment_documents").select("id", { count: "exact", head: true }).eq("storage_path", path),
  ]);
  // If either check fails, assume the file is in use: refusing is safe, deleting is not.
  if (pieceDocs.error || shipmentDocs.error) return true;
  return (pieceDocs.count ?? 0) + (shipmentDocs.count ?? 0) > 0;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.roles, "admin", "staff"))
    return NextResponse.json({ error: "Your role cannot attach documents" }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const scope = String(body.scope ?? "");
  const recordId = String(body.recordId ?? "");
  const path = String(body.path ?? "");
  const title = String(body.title ?? "").trim().slice(0, 300) || "Untitled";

  if (scope !== "document" && !/^[0-9a-f-]{36}$/.test(recordId))
    return NextResponse.json({ error: "Missing record" }, { status: 400 });
  const pattern = pathPattern(scope, recordId);
  if (!pattern || !pattern.test(path))
    return NextResponse.json({ error: "Path does not match scope" }, { status: 400 });

  // The path must be one /api/files/sign issued to this user for this
  // record, not yet recorded and not expired. Claiming it uses it up.
  const service = createServiceClient();
  const { data: claimed, error: claimErr } = await service.rpc("pending_upload_claim", {
    _user: session.user.id,
    _path: path,
    _scope: scope,
    _record: scope === "document" ? null : recordId,
  });
  // Until migration 0090 is applied there are no slips to claim: the commit
  // goes on under the checks below (a path a document row already uses is
  // refused, and only an unused file is ever removed), as before the slips.
  const noSlips = isMissingFunction(claimErr);
  if (claimErr && !noSlips)
    return NextResponse.json({ error: `Could not check the upload: ${claimErr.message}` }, { status: 500 });
  if (noSlips) console.warn("[files/commit] pending_upload_claim missing (migration 0090 not applied): slip not checked");
  else if (claimed !== true)
    return NextResponse.json(
      { error: "This upload was not started here or has expired — please attach the file again" },
      { status: 403 },
    );

  // The object must actually be there — commit is meaningless otherwise.
  const dir = path.slice(0, path.lastIndexOf("/"));
  const base = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed } = await service.storage
    .from("piece-documents")
    .list(dir, { search: base, limit: 1 });
  if (!listed?.some((o) => o.name === base))
    return NextResponse.json({ error: "File not found in storage — upload it first" }, { status: 400 });

  // A freshly issued key is never in use; one that is belongs to a document
  // already recorded, which this route neither records twice nor removes.
  if (await pathInUse(service, path))
    return NextResponse.json({ error: "This file is already recorded" }, { status: 409 });

  // The object's uuid doubles as the row id, as the old client flow did.
  const rowId = base.split(".")[0];
  const supabase = await getSupabase();

  let insErr: { message: string } | null = null;
  if (scope === "shipment") {
    const { error } = await supabase
      .from("shipment_documents")
      .insert({ id: rowId, shipment_id: recordId, title, storage_path: path });
    insErr = error;
  } else if (scope === "piece") {
    // The 0065 trigger writes the document_pieces link.
    const { error } = await supabase.from("piece_documents").insert({
      id: rowId,
      piece_id: recordId,
      doc_type: String(body.docType ?? "other"),
      title,
      storage_path: path,
    });
    insErr = error;
  } else {
    const { error } = await supabase.from("piece_documents").insert({
      id: rowId,
      piece_id: null,
      doc_type: String(body.docType ?? "other"),
      title,
      reference: String(body.reference ?? "").trim() || null,
      doc_date: String(body.docDate ?? "").trim() || null,
      storage_path: path,
    });
    insErr = error;
  }

  if (insErr) {
    // Refused row → take the file back out, so nothing is stranded. It is
    // the file this user's own sign request created (claimed above); look
    // once more that no row has come to point at it in the meantime.
    if (!(await pathInUse(service, path))) await service.storage.from("piece-documents").remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: rowId, title, storage_path: path });
}

import { NextResponse } from "next/server";
import { getSupabase, getSession } from "@/lib/supabase";
import { createServiceClient } from "@jvb/db/server";

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

/** The object key must be one this scope's sign step could have issued. */
function pathPattern(scope: string, recordId: string): RegExp | null {
  const uuid = "[0-9a-f-]{36}";
  const ext = "[a-z0-9]{1,5}";
  if (scope === "shipment") return new RegExp(`^shipments/${recordId}/${uuid}\\.${ext}$`);
  if (scope === "piece") return new RegExp(`^${recordId}/${uuid}\\.${ext}$`);
  if (scope === "document") return new RegExp(`^documents/${uuid}\\.${ext}$`);
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // The object must actually be there — commit is meaningless otherwise.
  const service = createServiceClient();
  const dir = path.slice(0, path.lastIndexOf("/"));
  const base = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed } = await service.storage
    .from("piece-documents")
    .list(dir, { search: base, limit: 1 });
  if (!listed?.some((o) => o.name === base))
    return NextResponse.json({ error: "File not found in storage — upload it first" }, { status: 400 });

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
    // Refused row → take the file back out, so nothing is stranded.
    await service.storage.from("piece-documents").remove([path]);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: rowId, title, storage_path: path });
}

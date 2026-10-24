import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabase, requireCapture } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a one-time signed upload URL into the private `captures` bucket. The
 * browser PUTs bytes straight to storage (no Next body-size limit).
 */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json().catch(() => ({}))) as {
    purpose?: string;
    ext?: string;
    batchId?: string;
    workId?: string;
    invoiceId?: string;
  };

  const ext = (body.ext || "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const file = `${randomUUID()}.${ext}`;

  // The ids become folder names in the object key, so they must be ids and
  // nothing else ("..", slashes): the row-level path guard (0090) would
  // refuse a crafted path later, but nothing should be signed for one.
  const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

  let path: string;
  switch (body.purpose) {
    case "work":
      if (!isId(body.batchId) || !isId(body.workId))
        return NextResponse.json({ error: "Missing ids" }, { status: 400 });
      path = `works/${body.batchId}/${body.workId}/${file}`;
      break;
    case "invoice":
      if (!isId(body.invoiceId))
        return NextResponse.json({ error: "Missing invoice" }, { status: 400 });
      path = `invoices/${body.invoiceId}/${file}`;
      break;
    case "card":
      path = `cards/${file}`;
      break;
    default:
      return NextResponse.json({ error: "Bad purpose" }, { status: 400 });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from("captures")
    .createSignedUploadUrl(path);
  if (error || !data)
    return NextResponse.json({ error: error?.message ?? "Upload URL failed" }, { status: 500 });

  return NextResponse.json({ path: data.path, token: data.token });
}

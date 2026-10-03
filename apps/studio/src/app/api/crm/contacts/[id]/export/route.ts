import { NextResponse } from "next/server";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { buildContactExport } from "@/lib/contact-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subject-access / portability export as JSON (UK GDPR Arts. 15 and 20). Admin only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = await buildContactExport(createServiceClient(), id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const name = [data.contact.first_name, data.contact.last_name].filter(Boolean).join("-") || id.slice(0, 8);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="personal-data-${name.replace(/[^\w-]+/g, "_")}.json"`,
      "cache-control": "no-store",
    },
  });
}

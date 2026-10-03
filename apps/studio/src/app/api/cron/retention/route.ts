import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily retention job: applies the periods in retention_policies (editable in
 * Admin → Data protection). Purge-mode classes are deleted past their period;
 * review-mode classes are only ever surfaced for a person to decide.
 * Auth: CRON_SECRET bearer header, as the other crons.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secret || !safeEqual(bearer, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const { data, error } = await db.rpc("apply_retention");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("dp_retention_runs").insert({ triggered_by: "cron", result: data });
  return NextResponse.json({ ok: true, result: data });
}

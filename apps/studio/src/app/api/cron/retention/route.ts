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
  const { data, error } = await createServiceClient().rpc("apply_retention");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

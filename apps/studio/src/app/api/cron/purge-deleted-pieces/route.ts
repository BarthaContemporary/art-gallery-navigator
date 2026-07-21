import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hard-deletes inventory pieces that have been in the trash for over 30 days.
 * Schedule daily via Vercel Cron. Auth: CRON_SECRET (Authorization: Bearer …).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const url = new URL(request.url);
  if (
    !secret ||
    !(safeEqual(bearer, secret) || safeEqual(url.searchParams.get("secret"), secret))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("purge_deleted_pieces");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also clear blank draft records left behind by "New record".
  const { data: blanks } = await supabase.rpc("purge_blank_draft_pieces", {
    grace: "2 hours",
  });

  return NextResponse.json({ ok: true, purged: data ?? 0, blankDrafts: blanks ?? 0 });
}

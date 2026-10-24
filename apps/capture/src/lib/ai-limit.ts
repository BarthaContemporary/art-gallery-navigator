import { NextResponse } from "next/server";
import { rateLimit } from "@jvb/db/rate-limit";
import { createServiceClient } from "@/lib/supabase";

/**
 * Per-person ceilings on the capture app's model calls (card scan, work
 * detection, invoice reading), as the studio has for its AI routes. They are
 * well above a long day at a fair, so normal capture never meets them; they
 * only stop a runaway client or a misused account running up model costs.
 * The shared limiter lets a request through if its own check fails.
 */
const PER_HOUR = { scan: 60, detect: 240, invoice: 60 } as const;

export type AiUse = keyof typeof PER_HOUR;

/** null when within the limit, otherwise the 429 response to return. */
export async function aiLimitResponse(userId: string, use: AiUse): Promise<NextResponse | null> {
  const ok = await rateLimit(createServiceClient(), `capture-ai-${use}:user:${userId}`, 3600, PER_HOUR[use]);
  if (ok) return null;
  return NextResponse.json(
    { error: `That is ${PER_HOUR[use]} in the last hour, the most allowed. Try again later.` },
    { status: 429 },
  );
}

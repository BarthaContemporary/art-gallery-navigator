import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { clientIp, OFFER_TOKEN } from "@/lib/form-fields";
import { grantCookieName, verifyGrant } from "@/lib/offer-access";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const responseSchema = z.object({
  response: z.enum(["interested", "declined"]).default("interested"),
  message: z.string().trim().max(2000).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

/** Responses per private link in an hour: one is the norm. */
const RESPONSES_PER_TOKEN = 10;

/**
 * "I'm interested" on a private offer page (components/offer-response.tsx).
 * It sits under /o/<token>/ so that the access cookie, which is scoped to
 * the offer's own path, comes with it: for a password-protected offer a
 * response is accepted only from someone who has unlocked it, not from
 * anyone holding the bare link (security review 2026-10, F21). Replaces
 * /api/offer-response, which could not see that cookie.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!OFFER_TOKEN.test(token)) {
    return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  }
  let payload: z.infer<typeof responseSchema>;
  try {
    const parsed = responseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const turnstile = await verifyTurnstile(payload.turnstileToken, clientIp(req.headers));
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    if (!(await rateLimit(supabase, `offer-response:token:${hashKey(token)}`, 3600, RESPONSES_PER_TOKEN))) {
      return NextResponse.json({ error: "Too many responses just now" }, { status: 429 });
    }

    const { data } = await supabase
      .from("offer_recipients")
      .select("id, contact_id, offer:offers ( id, title, access_password )")
      .eq("token", token)
      .maybeSingle();

    type OfferRow = { id: string; title: string | null; access_password: string | null };
    const recipient = data as unknown as {
      id: string;
      contact_id: string | null;
      offer: OfferRow | OfferRow[] | null;
    } | null;

    if (!recipient) {
      return NextResponse.json({ error: "Unknown token" }, { status: 404 });
    }
    const offer = Array.isArray(recipient.offer) ? (recipient.offer[0] ?? null) : recipient.offer;
    if (offer?.access_password && !verifyGrant(token, req.cookies.get(grantCookieName(token))?.value, Date.now())) {
      return NextResponse.json({ error: "Please unlock the selection first" }, { status: 401 });
    }

    const { error: updateError } = await supabase
      .from("offer_recipients")
      .update({ response: payload.response, responded_at: new Date().toISOString() })
      .eq("id", recipient.id);
    if (updateError) throw updateError;

    if (payload.response === "interested") {
      // Best-effort enquiry record — staff notification surface in the studio.
      const { error: enquiryError } = await supabase.from("enquiries").insert({
        contact_id: recipient.contact_id,
        channel: "offer",
        message:
          payload.message ??
          `Interested in offer "${offer?.title ?? offer?.id ?? "unknown"}".`,
      });
      if (enquiryError) {
        console.error("[offer-response] enquiry insert failed:", enquiryError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[offer-response] failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

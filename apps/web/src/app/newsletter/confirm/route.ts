import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { alreadyConfirmed, confirmSubscription, CONFIRM_TOKEN } from "@/lib/newsletter-optin";

export const dynamic = "force-dynamic";

/**
 * The "Confirm subscription" button on /newsletter/confirm/<token>. The only
 * place marketing consent from the website is switched on: a POST, which a
 * mail scanner following the emailed link never makes (security review
 * 2026-10, F22). A plain form post, so it works without JavaScript; it
 * answers with a redirect (303, so the browser follows it with a GET).
 */
export async function POST(req: NextRequest) {
  let token = "";
  try {
    token = String((await req.formData()).get("token") ?? "");
  } catch {
    token = "";
  }
  if (!CONFIRM_TOKEN.test(token)) {
    return NextResponse.redirect(new URL("/newsletter/confirm/expired", req.url), 303);
  }
  try {
    const supabase = createServiceClient();
    // A second press (a double click, or the page submitted twice) finds
    // the link already used for a subscription that stands: that is a
    // success too. An unknown or expired link goes back to its page, which
    // says so.
    const confirmed = (await confirmSubscription(supabase, token)) || (await alreadyConfirmed(supabase, token));
    return NextResponse.redirect(new URL(confirmed ? "/newsletter/confirmed" : `/newsletter/confirm/${token}`, req.url), 303);
  } catch (err) {
    console.error("[newsletter] confirmation failed:", err);
    return NextResponse.redirect(new URL(`/newsletter/confirm/${token}?retry=1`, req.url), 303);
  }
}

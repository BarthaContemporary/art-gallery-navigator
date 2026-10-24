import { NextResponse } from "next/server";
import { OFFER_TOKEN } from "@/lib/form-fields";
import { grantCookieName, signGrant, verifyGrant, GRANT_TTL_SECONDS } from "@/lib/offer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consume an emailed sign-in link: if the grant is valid, set the access
 * cookie and land the visitor on the offer. Otherwise send them to the gate.
 *
 * The link works for its 30 minutes, not once, and the email says so. Making
 * it single-use would let a mail-security scanner, which opens every link in
 * an incoming email, use it up before the recipient could (the problem F22
 * fixes for the newsletter); it is bound to one recipient's offer and only
 * ever sent to the address the gallery holds for them.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const k = url.searchParams.get("k") ?? "";
  const known = OFFER_TOKEN.test(token);
  const res = NextResponse.redirect(new URL(known ? `/o/${token}` : "/", url.origin));

  if (known && verifyGrant(token, k, Date.now())) {
    try {
      res.cookies.set(grantCookieName(token), signGrant(token, GRANT_TTL_SECONDS, Date.now()), {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: `/o/${token}`,
        maxAge: GRANT_TTL_SECONDS,
      });
    } catch (err) {
      console.error("[offer] sign-in link not honoured:", err);
    }
  }
  return res;
}

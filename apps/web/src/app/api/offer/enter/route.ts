import { NextResponse } from "next/server";
import { grantCookieName, signGrant, verifyGrant, GRANT_TTL_SECONDS } from "@/lib/offer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consume a magic sign-in link: if the grant is valid, set the access cookie
 * and land the visitor on the offer. Otherwise send them to the gate.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const k = url.searchParams.get("k") ?? "";
  const dest = token && token.length >= 8 ? `/o/${token}` : "/";
  const res = NextResponse.redirect(new URL(dest, url.origin));

  if (token && token.length >= 8 && verifyGrant(token, k, Date.now())) {
    res.cookies.set(grantCookieName(token), signGrant(token, GRANT_TTL_SECONDS, Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: `/o/${token}`,
      maxAge: GRANT_TTL_SECONDS,
    });
  }
  return res;
}

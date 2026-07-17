import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@jvb/db/server";
import { grantCookieName, signGrant, GRANT_TTL_SECONDS } from "@/lib/offer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OfferGateRow {
  access_password: string | null;
}

/** Verify an offer's simple password and, on success, set the access cookie. */
export async function POST(req: Request) {
  let token = "";
  let password = "";
  try {
    const body = (await req.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data } = await db
    .from("offer_recipients")
    .select("id, offer:offers ( access_password )")
    .eq("token", token)
    .maybeSingle();
  const rawOffer = (data as { offer?: OfferGateRow | OfferGateRow[] } | null)?.offer;
  const offer = Array.isArray(rawOffer) ? rawOffer[0] : rawOffer;
  const expected = offer?.access_password ?? null;

  // No gate configured — nothing to unlock.
  if (!expected) return NextResponse.json({ error: "Not gated" }, { status: 400 });
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(grantCookieName(token), signGrant(token, GRANT_TTL_SECONDS, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: `/o/${token}`,
    maxAge: GRANT_TTL_SECONDS,
  });
  return NextResponse.json({ ok: true });
}

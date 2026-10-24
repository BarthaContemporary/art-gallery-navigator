import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { clientIp, OFFER_TOKEN } from "@/lib/form-fields";
import { grantCookieName, passwordMatches, signGrant, GRANT_TTL_SECONDS } from "@/lib/offer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OfferGateRow {
  access_password: string | null;
}

/**
 * Tries per private link, and per visitor address, in an hour. Offer
 * passwords are short words chosen by staff, so without a limit a leaked
 * link could be unlocked by guessing (security review 2026-10, F21). The
 * recipient can always use the emailed sign-in link instead.
 */
const TRIES_PER_TOKEN = 10;
const TRIES_PER_IP = 30;

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
  if (!OFFER_TOKEN.test(token)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = createServiceClient();
  // Every try counts, right or wrong, and is counted before the password is
  // looked at, so a guess past the limit learns nothing.
  const ip = clientIp(req.headers);
  const [tokenOk, ipOk] = await Promise.all([
    rateLimit(db, `offer-unlock:token:${hashKey(token)}`, 3600, TRIES_PER_TOKEN),
    ip ? rateLimit(db, `offer-unlock:ip:${hashKey(ip)}`, 3600, TRIES_PER_IP) : Promise.resolve(true),
  ]);
  if (!tokenOk || !ipOk) {
    return NextResponse.json(
      { error: "Too many tries. Please wait an hour, or use the emailed sign-in link below." },
      { status: 429 },
    );
  }

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
  if (!passwordMatches(password, expected)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  let grant: string;
  try {
    grant = signGrant(token, GRANT_TTL_SECONDS, Date.now());
  } catch (err) {
    console.error("[offer] unlock refused:", err);
    return NextResponse.json({ error: "Private viewings cannot be opened just now." }, { status: 503 });
  }
  const jar = await cookies();
  jar.set(grantCookieName(token), grant, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: `/o/${token}`,
    maxAge: GRANT_TTL_SECONDS,
  });
  return NextResponse.json({ ok: true });
}

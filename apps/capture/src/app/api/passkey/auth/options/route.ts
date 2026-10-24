import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { issueChallenge, rpInfo } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starting a sign-in is public and writes one challenge row, so one address
 * may start at most this many in five minutes; far above a person retrying.
 */
const STARTS_PER_IP = 30;

/**
 * Authentication challenge. Public (no session yet). We allow any discoverable
 * credential (usernameless) so the user just taps and confirms with Face ID.
 */
export async function POST() {
  // Vercel sets x-real-ip (and the first x-forwarded-for entry) itself.
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (ip && !(await rateLimit(createServiceClient(), `passkey-start-capture:ip:${hashKey(ip)}`, 300, STARTS_PER_IP)))
    return NextResponse.json({ error: "Too many sign-in attempts. Try again in a few minutes." }, { status: 429 });
  const { rpID, secure } = await rpInfo();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [],
  });
  if (!(await issueChallenge("login", options.challenge, secure)))
    return NextResponse.json({ error: "Passkey sign-in is unavailable right now" }, { status: 503 });
  return NextResponse.json(options);
}

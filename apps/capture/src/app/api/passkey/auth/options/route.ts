import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { issueChallenge, rpInfo } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authentication challenge. Public (no session yet). We allow any discoverable
 * credential (usernameless) so the user just taps and confirms with Face ID.
 */
export async function POST() {
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

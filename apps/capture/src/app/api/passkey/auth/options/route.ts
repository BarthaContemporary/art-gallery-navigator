import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpInfo, stashChallenge } from "@/lib/webauthn";

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
    userVerification: "preferred",
    allowCredentials: [],
  });
  await stashChallenge("auth", options.challenge, secure);
  return NextResponse.json(options);
}

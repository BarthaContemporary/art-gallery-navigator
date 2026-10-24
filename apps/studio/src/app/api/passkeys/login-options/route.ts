import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { issueChallenge, relyingParty } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Options for passkey sign-in. allowCredentials stays empty: the passkeys
 * are discoverable (resident), so the platform shows the account picker —
 * Face ID / Touch ID on the device, or "use iPhone/iPad" via QR from a Mac.
 */
export async function POST() {
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [],
  });
  if (!(await issueChallenge("login", options.challenge)))
    return NextResponse.json({ error: "Passkey sign-in is unavailable right now" }, { status: 503 });
  return NextResponse.json(options);
}

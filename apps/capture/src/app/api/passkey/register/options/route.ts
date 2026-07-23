import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";
import { rpInfo, stashChallenge, RP_NAME } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registration challenge — only a signed-in user can enrol a new passkey. */
export async function POST() {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const user = gate.session.user;
  const { rpID, secure } = await rpInfo();

  const db = createServiceClient();
  const { data: existing } = await db
    .from("passkeys")
    .select("id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "Capture user",
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.id as string,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      // Apple Face ID / Touch ID = a platform authenticator with a discoverable
      // (resident) credential, synced via iCloud Keychain. Requiring a resident
      // key is what makes usernameless Face ID sign-in work.
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });

  await stashChallenge("reg", options.challenge, secure);
  return NextResponse.json(options);
}

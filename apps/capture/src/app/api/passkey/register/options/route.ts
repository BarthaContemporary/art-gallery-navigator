import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";
import { fromOwnOrigin, issueChallenge, rpInfo, signedInRecently, RP_NAME } from "@/lib/webauthn";
import { REAUTH_MESSAGE } from "@/lib/passkey-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registration challenge — only a signed-in user can enrol a new passkey. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!(await fromOwnOrigin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = gate.session.user;

  // A passkey outlasts the session that adds it, so adding one needs a
  // recent sign-in, not just a live session (someone else's for a few
  // minutes on an unlocked phone, say). The app offers "Sign in again".
  if (!(await signedInRecently(user.id, user.last_sign_in_at)))
    return NextResponse.json({ error: REAUTH_MESSAGE, reauth: true }, { status: 403 });

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

  // Bound to this user: nobody else's enrolment can use it.
  if (!(await issueChallenge("register", options.challenge, secure, user.id)))
    return NextResponse.json({ error: "Passkeys are unavailable right now; try again later" }, { status: 503 });
  return NextResponse.json(options);
}

import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSession, createServiceClient } from "@/lib/supabase";
import { fromOwnOrigin, issueChallenge, relyingParty, signedInRecently } from "@/lib/webauthn";
import { REAUTH_MESSAGE } from "@/lib/passkey-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Options for enrolling a new passkey on the signed-in user's account. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await fromOwnOrigin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // A passkey outlasts the session that adds it, so adding one needs a
  // recent sign-in, not just a live session (someone else's for a few
  // minutes on an unlocked laptop, say). The browser offers "Sign in again".
  if (!(await signedInRecently(session.user.id, session.user.last_sign_in_at)))
    return NextResponse.json({ error: REAUTH_MESSAGE, reauth: true }, { status: 403 });

  const svc = createServiceClient();
  const { data: existing } = await svc
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", session.user.id);

  const { rpID, rpName } = await relyingParty();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: session.user.email ?? session.user.id,
    userDisplayName: session.user.email ?? "Studio user",
    // Discoverable credential + biometric check: this is what makes the
    // passkey land in iCloud Keychain and unlock with Face ID / Touch ID,
    // and lets login work without typing an email first.
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: (c.transports ?? undefined) as
        | import("@simplewebauthn/server").AuthenticatorTransportFuture[]
        | undefined,
    })),
  });

  // Bound to this user: nobody else's enrolment can use it.
  if (!(await issueChallenge("register", options.challenge, session.user.id)))
    return NextResponse.json({ error: "Passkeys are unavailable right now; try again later" }, { status: 503 });
  return NextResponse.json(options);
}

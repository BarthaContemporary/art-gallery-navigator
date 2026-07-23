import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSession, createServiceClient } from "@/lib/supabase";
import { relyingParty, setChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Options for enrolling a new passkey on the signed-in user's account. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  await setChallenge("pk_reg", options.challenge);
  return NextResponse.json(options);
}

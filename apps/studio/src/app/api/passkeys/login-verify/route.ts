import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { createServiceClient } from "@/lib/supabase";
import { relyingParty, takeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify a passkey assertion and bridge it into a Supabase session: on
 * success we mint a one-time magic-link token for the credential's owner
 * and hand its token_hash to the browser, which exchanges it via
 * auth.verifyOtp — from there on it is a completely normal session.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    response: AuthenticationResponseJSON;
  } | null;
  if (!body?.response?.id) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const expectedChallenge = await takeChallenge("pk_auth");
  if (!expectedChallenge)
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });

  const svc = createServiceClient();
  const { data: cred } = await svc
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", body.response.id)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "Unknown passkey" }, { status: 400 });

  const { rpID, origin } = await relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id as string,
        publicKey: new Uint8Array(Buffer.from(cred.public_key as string, "base64")),
        counter: Number(cred.counter),
        transports: (cred.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 400 },
    );
  }
  if (!verification.verified)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });

  await svc
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  const { data: userRes, error: userErr } = await svc.auth.admin.getUserById(
    cred.user_id as string,
  );
  const email = userRes?.user?.email;
  if (userErr || !email)
    return NextResponse.json({ error: "Account not found" }, { status: 400 });

  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash)
    return NextResponse.json(
      { error: linkErr?.message ?? "Could not start session" },
      { status: 500 },
    );

  return NextResponse.json({ ok: true, token_hash: tokenHash });
}

import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getSession, createServiceClient } from "@/lib/supabase";
import { relyingParty, takeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    response: RegistrationResponseJSON;
    label?: string;
  } | null;
  if (!body?.response) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const expectedChallenge = await takeChallenge("pk_reg");
  if (!expectedChallenge)
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });

  const { rpID, origin } = await relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 400 },
    );
  }
  if (!verification.verified || !verification.registrationInfo)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });

  const { credential } = verification.registrationInfo;
  const svc = createServiceClient();
  const { error } = await svc.from("webauthn_credentials").insert({
    user_id: session.user.id,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_label: (body.label ?? "").slice(0, 80) || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

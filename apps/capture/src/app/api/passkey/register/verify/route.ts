import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";
import { rpInfo, takeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify a registration response and store the new credential. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { rpID, origin } = await rpInfo();

  const body = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    label?: string;
  };
  if (!body.response) return NextResponse.json({ error: "Missing response" }, { status: 400 });

  const expectedChallenge = await takeChallenge("reg");
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Verify failed" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo)
    return NextResponse.json({ error: "Could not verify passkey" }, { status: 400 });

  const { credential } = verification.registrationInfo;
  const db = createServiceClient();
  const { error } = await db.from("passkeys").insert({
    id: credential.id,
    user_id: gate.session.user.id,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_label: body.label?.trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

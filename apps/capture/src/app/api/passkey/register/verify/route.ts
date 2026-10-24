import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireCapture, createServiceClient } from "@/lib/supabase";
import { fromOwnOrigin, rpInfo, takeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify a registration response and store the new credential. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  // A page on a sibling subdomain shares the session cookies but not the
  // origin: it must not enrol its own key on this account.
  if (!(await fromOwnOrigin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { rpID, origin, secure } = await rpInfo();

  const body = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    label?: unknown;
  };
  if (!body.response) return NextResponse.json({ error: "Missing response" }, { status: 400 });

  // Only a challenge register/options issued to this very user, after a
  // recent sign-in, is accepted; it is used up either way.
  const expectedChallenge = await takeChallenge("register", secure, gate.session.user.id);
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });

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
    // Shown to the admin beside every passkey, so kept to a short label.
    device_label: (typeof body.label === "string" ? body.label.trim().slice(0, 80) : "") || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getSupabase, createServiceClient } from "@/lib/supabase";
import { rpInfo, takeChallenge } from "@/lib/webauthn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify a passkey assertion and, on success, establish a Supabase session for
 * the credential's owner. Self-hosted GoTrue has no native passkey grant, so
 * we mint the session server-side: admin generateLink → verifyOtp (no email is
 * ever sent), which sets the auth cookies on the response.
 */
export async function POST(req: Request) {
  const { rpID, origin } = await rpInfo();
  const body = (await req.json().catch(() => ({}))) as { response?: AuthenticationResponseJSON };
  if (!body.response?.id) return NextResponse.json({ error: "Missing response" }, { status: 400 });

  const expectedChallenge = await takeChallenge("auth");
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });

  const db = createServiceClient();
  const { data: pk } = await db
    .from("passkeys")
    .select("id, user_id, public_key, counter, transports")
    .eq("id", body.response.id)
    .maybeSingle();
  if (!pk) return NextResponse.json({ error: "Unknown passkey" }, { status: 404 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: pk.id as string,
        publicKey: new Uint8Array(Buffer.from(pk.public_key as string, "base64")),
        counter: Number(pk.counter),
        transports: (pk.transports ?? []) as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Verify failed" }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: "Not verified" }, { status: 401 });

  // Advance the signature counter (clone/replay detection).
  await db
    .from("passkeys")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", pk.id);

  // Look up the owner's email, mint an OTP, verify it to set session cookies.
  const { data: userRes } = await db.auth.admin.getUserById(pk.user_id as string);
  const email = userRes.user?.email;
  if (!email) return NextResponse.json({ error: "User has no email" }, { status: 500 });

  const { data: link, error: linkErr } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return NextResponse.json({ error: "Could not start session" }, { status: 500 });

  // Verify the hashed token server-side (no email sent); this sets the auth
  // cookies on the response via the SSR cookie adapter.
  const supabase = await getSupabase();
  const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (otpErr) return NextResponse.json({ error: otpErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { cookies, headers } from "next/headers";

/**
 * Derive the WebAuthn Relying Party ID + expected origin from the request (or
 * an explicit override). The RP ID must be the site's domain (no port/scheme);
 * a passkey is bound to it, so it must stay stable across deploys — register
 * and use passkeys on the production domain, not a rotating preview URL.
 */
export async function rpInfo() {
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rpID = process.env.NEXT_PUBLIC_PASSKEY_RP_ID || host.split(":")[0] || "localhost";
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || `${proto}://${host}`;
  return { rpID, origin, secure: proto === "https" };
}

const REG_COOKIE = "pk_reg_challenge";
const AUTH_COOKIE = "pk_auth_challenge";

export async function stashChallenge(kind: "reg" | "auth", challenge: string, secure: boolean) {
  const c = await cookies();
  c.set(kind === "reg" ? REG_COOKIE : AUTH_COOKIE, challenge, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  });
}

/** Read and immediately clear a stored challenge (single use). */
export async function takeChallenge(kind: "reg" | "auth"): Promise<string | null> {
  const name = kind === "reg" ? REG_COOKIE : AUTH_COOKIE;
  const c = await cookies();
  const value = c.get(name)?.value ?? null;
  if (value) c.set(name, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return value;
}

export const RP_NAME = "JvB Capture";

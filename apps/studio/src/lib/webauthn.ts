import { cookies, headers } from "next/headers";

/**
 * Shared bits for the passkey routes. The relying-party ID is the studio's
 * own hostname (derived per request, so preview deployments work too);
 * challenges live in short-lived httpOnly cookies between the options call
 * and the verify call — no server-side session state needed.
 */

export async function relyingParty() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const rpID = host.split(":")[0] ?? host;
  return { rpID, origin: `${proto}://${host}`, rpName: "Joost van den Bergh Studio" };
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 300,
};

export async function setChallenge(name: "pk_reg" | "pk_auth", challenge: string) {
  (await cookies()).set(name, challenge, COOKIE_OPTS);
}

export async function takeChallenge(name: "pk_reg" | "pk_auth"): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(name)?.value ?? null;
  jar.delete(name);
  return value;
}

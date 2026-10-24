import { cookies, headers } from "next/headers";
import { createServiceClient, getSupabase } from "@/lib/supabase";
import {
  CHALLENGE_SECONDS,
  challengeCookieName,
  isChallengeId,
  isFreshSignIn,
  isSameOrigin,
  sessionSignedInAt,
  type ChallengePurpose,
} from "@/lib/passkey-rules";

/**
 * Shared bits for the passkey routes. The relying-party ID is the studio's
 * own hostname (derived per request, so preview deployments work too).
 *
 * Challenges are kept on the server (webauthn_challenges, migration 0092).
 * The options call records one and gives the browser only the record's
 * random id, in an HttpOnly cookie (a __Host- one over https, so everywhere
 * but local development); the verify call takes the record out in one step,
 * so a challenge works once, within five minutes, for the purpose (and, for
 * enrolment, the user) it was issued for. The browser never holds the
 * challenge itself, so a passkey answer seen once (a shared HAR file, a
 * proxy log) cannot be replayed as a new sign-in.
 */

export async function relyingParty() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const rpID = host.split(":")[0] ?? host;
  return {
    rpID,
    origin: `${proto}://${host}`,
    rpName: "Joost van den Bergh Studio",
    secure: proto === "https",
  };
}

const APP = "studio";

// Secure (over https), path "/" and no Domain: what a __Host- cookie must have.
function cookieOptions(secure: boolean, maxAge: number) {
  return { httpOnly: true, secure, sameSite: "strict" as const, path: "/", maxAge };
}

/**
 * Record a challenge for this browser; false when it could not be stored
 * (the route then answers 503 and the password still works).
 */
export async function issueChallenge(
  purpose: ChallengePurpose,
  challenge: string,
  userId: string | null = null,
): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("webauthn_challenge_issue", {
    _app: APP,
    _purpose: purpose,
    _challenge: challenge,
    _user_id: userId,
  });
  if (error || !isChallengeId(data)) {
    console.error(`[passkeys] could not store a ${purpose} challenge: ${error?.message ?? "no id returned"}`);
    return false;
  }
  const { secure } = await relyingParty();
  (await cookies()).set(challengeCookieName(purpose, secure), data, cookieOptions(secure, CHALLENGE_SECONDS));
  return true;
}

/**
 * The challenge this browser was issued for `purpose` (an enrolment one only
 * for `userId`), taken out so it cannot be used again; null when there is
 * none, it has expired, or it is not this caller's to use.
 */
export async function takeChallenge(
  purpose: ChallengePurpose,
  userId: string | null = null,
): Promise<string | null> {
  const { secure } = await relyingParty();
  const jar = await cookies();
  const name = challengeCookieName(purpose, secure);
  const id = jar.get(name)?.value;
  jar.set(name, "", cookieOptions(secure, 0));
  if (!isChallengeId(id)) return null;
  const { data, error } = await createServiceClient().rpc("webauthn_challenge_take", {
    _id: id,
    _app: APP,
    _purpose: purpose,
    _user_id: userId,
  });
  if (error) {
    console.error(`[passkeys] could not check a ${purpose} challenge: ${error.message}`);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/**
 * True when the request was sent by a page of this studio. A sibling
 * subdomain is the same site, so the session cookies go along with its
 * requests; only the Origin header tells it apart.
 */
export async function fromOwnOrigin(req: Request): Promise<boolean> {
  const { origin } = await relyingParty();
  return isSameOrigin(req.headers.get("origin"), origin);
}

/**
 * True when this browser's session signed in recently enough to enrol a
 * passkey. The sign-in time comes from the session's own access token, read
 * through getClaims (which has the auth server vouch for the token), so a
 * session kept alive for days, or borrowed, does not pass.
 */
export async function signedInRecently(userId: string, lastSignInAt?: string | null): Promise<boolean> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims || data.claims.sub !== userId) return false;
  return isFreshSignIn(sessionSignedInAt(data.claims, lastSignInAt));
}

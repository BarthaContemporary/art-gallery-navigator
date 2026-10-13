/*
 * The two fictional sign-ins and the cookie that carries them.
 *
 * @supabase/ssr 0.6.1 (the studio's version) stores the session under the
 * storage key `sb-<first label of the Supabase URL's hostname>-auth-token`,
 * so with http://127.0.0.1:54321 the cookie is `sb-127-auth-token`. The value
 * is "base64-" followed by the base64url of the session JSON (cookieEncoding
 * "base64url"); a value over 3180 encoded characters would be split into
 * `.0`, `.1` chunks, which these sessions never reach. auth-js accepts any
 * stored object with access_token, refresh_token and expires_at; while
 * expires_at is more than 90 seconds away it never refreshes, and getUser()
 * then sends the access token to GET /auth/v1/user, which the mock answers
 * from the token's `sub`.
 */

export const SUPABASE_URL = "http://127.0.0.1:54321";
export const COOKIE_NAME = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

export const USERS = {
  admin: {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "harriet.lowe@example.com",
    full_name: "Harriet Lowe",
    role: "admin",
  },
  staff: {
    id: "a0000000-0000-4000-8000-000000000002",
    email: "sam.okafor@example.com",
    full_name: "Sam Okafor",
    role: "staff",
  },
};

/** A third account that appears in the admin user list only. */
export const OTHER_USERS = [
  {
    id: "a0000000-0000-4000-8000-000000000003",
    email: "priya.raman@example.com",
    full_name: "Priya Raman",
    role: "accountant",
  },
];

const b64url = (s) => Buffer.from(s).toString("base64url");

export function makeJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  // Unsigned in any meaningful sense: nothing in the preview verifies it.
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${b64url("preview-signature")}`;
}

export function decodeJwt(token) {
  try {
    const part = String(token).split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Keys the studio is started with. The role claim is what the mock reads. */
export const ANON_KEY = makeJwt({ iss: "studio-preview", role: "anon", exp: 4102444800 });
export const SERVICE_KEY = makeJwt({ iss: "studio-preview", role: "service_role", exp: 4102444800 });

export function authUser(u) {
  const created = "2025-03-02T09:14:00.000Z";
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: created,
    phone: "",
    confirmed_at: created,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: u.full_name },
    identities: [],
    created_at: created,
    updated_at: created,
    is_anonymous: false,
  };
}

export function sessionFor(roleName) {
  const u = USERS[roleName];
  if (!u) throw new Error(`Unknown role ${roleName}; use admin or staff`);
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
  const accessToken = makeJwt({
    iss: "studio-preview",
    sub: u.id,
    email: u.email,
    role: "authenticated",
    aud: "authenticated",
    app_role: u.role,
    session_id: `preview-${u.role}`,
    iat: Math.floor(Date.now() / 1000),
    exp: expiresAt,
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    expires_at: expiresAt,
    refresh_token: `preview-refresh-${u.role}`,
    user: authUser(u),
  };
}

/**
 * The cookies a browser needs to be signed in as `roleName`: one, or the
 * `.0`, `.1` chunks @supabase/ssr reassembles when the value is long.
 */
export function sessionCookies(roleName) {
  const value = `base64-${b64url(JSON.stringify(sessionFor(roleName)))}`;
  const MAX = 3180; // MAX_CHUNK_SIZE in @supabase/ssr/dist/main/utils/chunker.js
  if (value.length <= MAX) return [{ name: COOKIE_NAME, value }];
  const out = [];
  for (let i = 0; i * MAX < value.length; i++) out.push({ name: `${COOKIE_NAME}.${i}`, value: value.slice(i * MAX, (i + 1) * MAX) });
  return out;
}

/** Which fictional user a bearer token belongs to (null for keys). */
export function userForToken(token) {
  const claims = decodeJwt(token);
  if (!claims) return null;
  if (claims.role === "service_role") return { role: "service" };
  if (claims.role === "anon") return { role: "anon" };
  const all = [...Object.values(USERS), ...OTHER_USERS];
  const u = all.find((x) => x.id === claims.sub) ?? all.find((x) => x.role === claims.app_role);
  return u ? { role: u.role, user: u } : null;
}

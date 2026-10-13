/**
 * Sign-in rules shared by the middleware, the sign-in pages and the password
 * forms. Plain functions and constants only: this module runs in the edge
 * middleware and in the browser as well as on the server.
 */

/**
 * Shortest password the auth server accepts (GOTRUE_PASSWORD_MIN_LENGTH in
 * infra/compose/docker-compose.yml). Every form, hint and check reads this,
 * so a password the server will refuse is refused in the form first.
 */
export const PASSWORD_MIN = 12;

/** Placeholder origin for parsing; never seen outside this file. */
const BASE = "http://studio.invalid";

/**
 * The `next` page to return to after sign-in, or null when the value is not a
 * plain path on this site. Only "/something" is accepted: "//host" and
 * "/\host" read as another site in browsers, the URL parser drops tabs and
 * newlines (so "/\t/host" would become "//host"), and dot segments can
 * collapse to "//host" too, so the parsed result is checked again. The
 * sign-in page itself (a loop) and API routes (a download or JSON, not a page
 * to land on) are refused as well.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname + url.search + url.hash;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const p = url.pathname;
  if (p === "/login" || p.startsWith("/login/")) return null;
  if (p === "/api" || p.startsWith("/api/")) return null;
  return path;
}

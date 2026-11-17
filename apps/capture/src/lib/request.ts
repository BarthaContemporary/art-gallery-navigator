/**
 * The capture screens' calls to their own API. Every call goes through
 * requestJson(), which throws a RequestError with something a person can act
 * on: no connection, signed out, or the server's own error text. A screen
 * never treats a failed or unreadable reply as a success. Pure (no imports)
 * so `node --test` can load it.
 */

export const SIGNED_OUT = "Signed out — this was not saved. Reload the page and sign in again.";
export const NO_CONNECTION = "No connection — check the signal and try again.";

export class RequestError extends Error {
  readonly status: number;
  readonly signedOut: boolean;
  constructor(message: string, status: number, signedOut = false) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.signedOut = signedOut;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function errorText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const e = (data as { error?: unknown }).error;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

/**
 * fetch() that resolves only with a JSON object from a 2xx reply. A signed-out
 * call (401, or a redirect to the sign-in page from an older middleware) is
 * RequestError.signedOut; a rejected fetch is NO_CONNECTION; any other non-2xx
 * carries the server's `error` text.
 */
export async function requestJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new RequestError(NO_CONNECTION, 0);
  }
  if (res.status === 401 || (res.redirected && pathOf(res.url) === "/login")) {
    throw new RequestError(SIGNED_OUT, 401, true);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new RequestError(errorText(data) ?? `The server answered ${res.status}. Try again.`, res.status);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new RequestError("The server's reply could not be read. Try again.", res.status);
  }
  return data as T;
}

/** A JSON request body for requestJson(). */
export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

/** The message to show for an error thrown by requestJson() or an upload. */
export function messageOf(e: unknown, fallback: string): string {
  if (e instanceof RequestError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

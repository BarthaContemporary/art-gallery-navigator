/*
 * What an autosave PATCH's answer means for the editor that sent it.
 *
 * Every autosaving editor in the studio (AutosaveForm, useStateAutosave, the
 * contact editor, the newsletter designer, the maker editor) reads its
 * answer through readSaveOutcome, so they agree on three cases:
 *
 *   ok          the server holds what was sent.
 *   signedOut   401, or a redirect to /login: only signing in again helps.
 *               The edit is kept and tried again.
 *   final       the server refused this save for good: the role may not
 *               write (403), the record is gone or no row changed (404), or
 *               it did not accept the values (400, 409, 410, 413, 422).
 *               Sending the same thing again gets the same answer, so the
 *               editor stops retrying, shows `message` on its save line and
 *               does not ask before the page is left (nothing a retry could
 *               save would be lost). The next edit is sent as usual.
 *   otherwise   a failure that may pass (a dropped connection, a 5xx, a
 *               timeout): kept and tried again with the editor's backoff.
 *
 * Pure apart from reading the response body; the unit test is
 * save-outcome.test.ts.
 */

export type SaveOutcome = {
  ok: boolean;
  /** HTTP status, when an answer came back. */
  status?: number;
  /** The session lapsed: only signing in again helps. */
  signedOut?: boolean;
  /** Refused for good: no automatic retry, no leave-page question. */
  final?: boolean;
  /** For a final refusal: the sentence the save line shows after "Couldn’t save …". */
  message?: string;
};

/** Answers that sending the same request again cannot change. */
export const FINAL_STATUSES: ReadonlySet<number> = new Set([400, 403, 404, 409, 410, 413, 422]);

/** Generic route texts that say less than the default for their status. */
const BARE = /^(forbidden|not found|unauthori[sz]ed|bad request|conflict|gone|error)\.?$/i;

const DEFAULTS: Record<number, string> = {
  400: "The server did not accept these values.",
  403: "Your role cannot change this.",
  404: "It was not found: it may have been deleted, or it is not yours to edit.",
  409: "It was changed elsewhere in the meantime. Reload the page to see what is stored.",
  410: "It no longer exists.",
  413: "It is too large to save.",
  422: "The server did not accept these values.",
};

/** A sentence for the save line from the route's {error} text, or the default for the status. */
export function refusalMessage(status: number, error?: unknown): string {
  const text = typeof error === "string" ? error.trim().replace(/\s+/g, " ").slice(0, 200) : "";
  if (!text || BARE.test(text)) return DEFAULTS[status] ?? "The server refused it.";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Read a PATCH answer. Never throws; a body that is not JSON is ignored. */
export async function readSaveOutcome(res: Response): Promise<SaveOutcome> {
  const toLogin = res.redirected && safePath(res.url).startsWith("/login");
  if (res.status === 401 || toLogin) return { ok: false, status: res.status, signedOut: true };
  if (res.ok) return { ok: true, status: res.status };
  if (FINAL_STATUSES.has(res.status)) {
    let error: unknown;
    try {
      error = ((await res.clone().json()) as { error?: unknown } | null)?.error;
    } catch {
      /* not JSON: the default text for the status */
    }
    return { ok: false, status: res.status, final: true, message: refusalMessage(res.status, error) };
  }
  return { ok: false, status: res.status };
}

/** The outcome of a request that never got an answer (offline, aborted, a body over the keepalive cap). */
export const NO_ANSWER: SaveOutcome = { ok: false };

/** `send` functions may still answer a plain boolean; this reads either. */
export function asOutcome(value: boolean | SaveOutcome | null | undefined): SaveOutcome {
  if (typeof value === "boolean") return { ok: value };
  return value ?? NO_ANSWER;
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

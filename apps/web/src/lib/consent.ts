/**
 * Consent state for the public site.
 *
 * Two purposes are exposed to the visitor, because two are all we can honestly
 * describe:
 *   analytics  — Plausible today; the identified engagement tracking (CEIS
 *                `site_tracking`) when that ships.
 *   marketing  — third-party advertising pixels (Facebook and any successor).
 *
 * Both require consent under PECR before anything is stored on the device or
 * any third-party script loads. Nothing here runs at import time; the gate is
 * enforced by the components that consume it, so tracking without consent is
 * impossible rather than merely avoided.
 */

export type Purpose = "analytics" | "marketing";
export type Status = "granted" | "denied";

export type ConsentRecord = {
  v: 1;
  /** ISO timestamp of the decision — evidence for the consent ledger. */
  ts: string;
  analytics: Status;
  marketing: Status;
};

/** No record at all means the visitor has not decided; show the banner. */
export type ConsentState = ConsentRecord | null;

export const CONSENT_KEY = "jvb.consent.v1";

/** Broadcast so gated scripts can react the instant a decision is made. */
export const CONSENT_EVENT = "jvb:consent";

export const DENY_ALL: Omit<ConsentRecord, "ts" | "v"> = {
  analytics: "denied",
  marketing: "denied",
};

export const GRANT_ALL: Omit<ConsentRecord, "ts" | "v"> = {
  analytics: "granted",
  marketing: "granted",
};

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ConsentRecord).v === 1 &&
      isStatus((parsed as ConsentRecord).analytics) &&
      isStatus((parsed as ConsentRecord).marketing)
    ) {
      return parsed as ConsentRecord;
    }
    // Unrecognised or superseded shape — treat as undecided and re-ask.
    return null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: Omit<ConsentRecord, "ts" | "v">): ConsentRecord {
  const record: ConsentRecord = { v: 1, ts: new Date().toISOString(), ...choice };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* private mode / storage disabled — the session still honours the choice */
  }
  window.dispatchEvent(new CustomEvent<ConsentRecord>(CONSENT_EVENT, { detail: record }));
  return record;
}

/** Withdrawal must be as easy as granting, and must clear what was stored. */
export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

export function granted(state: ConsentState, purpose: Purpose): boolean {
  return state?.[purpose] === "granted";
}

function isStatus(v: unknown): v is Status {
  return v === "granted" || v === "denied";
}

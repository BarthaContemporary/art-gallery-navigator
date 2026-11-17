/*
 * What a contact autosave (PATCH /api/crm/contacts/[id]) may write, pure so
 * it can be tested (contact-save.test.ts).
 *
 * The editor posts its whole form on every save, and a tab can stay open for
 * hours. Meanwhile other writers change the same flags: the newsletter
 * opt-in confirmation sets marketing_consent, an unsubscribe clears it, a
 * hard bounce or complaint sets do_not_mail, a sale adds an interest. A save
 * that simply wrote the form would put the tab's old values back over them.
 *
 * So the editor also posts, beside each such field, the value it last knew
 * the server to hold (`<field>_was`: as rendered, then as last saved). A flag
 * is written only when the posted value differs from that, which is when the
 * person at this tab changed it. Interests are merged: the names added here
 * are added to what is stored, the names removed here are removed, anything
 * else stored stays. A request without the `_was` keys (an editor from
 * before this change, still open in a tab) is written as before.
 */

type Fd = Pick<FormData, "get" | "has">;

const on = (fd: Fd, k: string) => fd.get(k) === "on";

/** The contact's consent, do-not-mail and AML status, only those the user changed. */
export function changedFlags(fd: Fd): { marketing_consent?: boolean; do_not_mail?: boolean; kyc_status?: string } {
  const out: { marketing_consent?: boolean; do_not_mail?: boolean; kyc_status?: string } = {};
  for (const k of ["marketing_consent", "do_not_mail"] as const) {
    if (!fd.has(`${k}_was`) || on(fd, `${k}_was`) !== on(fd, k)) out[k] = on(fd, k);
  }
  const kyc = String(fd.get("kyc_status") ?? "").trim() || "not_started";
  const kycWas = fd.has("kyc_status_was") ? String(fd.get("kyc_status_was") ?? "").trim() || "not_started" : null;
  if (kycWas === null || kycWas !== kyc) out.kyc_status = kyc;
  return out;
}

/** A JSON list of names from the form, or null when the key is absent or unreadable. */
export function parseNames(raw: FormDataEntryValue | null): string[] | null {
  if (raw === null) return null;
  try {
    const arr = JSON.parse(String(raw));
    return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : null;
  } catch {
    return null;
  }
}

/**
 * The interests to store. `was` null (an older editor): the posted list, as
 * before. Otherwise the stored list with this tab's additions and removals.
 */
export function mergeInterests(stored: unknown, posted: string[], was: string[] | null): string[] {
  if (was === null) return posted;
  const current = Array.isArray(stored) ? stored.map((x) => String(x)).filter(Boolean) : [];
  const added = posted.filter((n) => !was.includes(n));
  const removed = new Set(was.filter((n) => !posted.includes(n)));
  const out = current.filter((n) => !removed.has(n));
  for (const n of added) if (!out.includes(n)) out.push(n);
  return out;
}

/**
 * Consent needs provenance, not just a tick.
 *
 * UK GDPR Art. 7(1) puts the burden on the controller to demonstrate that
 * consent was given; a boolean with no date or source demonstrates nothing.
 * So the first time consent is granted, stamp when and by whom. An existing
 * date is never overwritten — the original record is the evidence, and a
 * later save must not quietly re-date it. Withdrawal keeps the date and
 * source too: the audit question is often "when did they consent, and when
 * did that change", and erasing the history to answer only the second is a
 * poorer record.
 *
 * `prev` must be the row as read: a failed read is an error for the caller,
 * never an empty row (that would re-date the consent of someone who already
 * consents).
 */
export function consentStamp(
  prev: { marketing_consent: boolean | null; consent_date: string | null; consent_source: string | null },
  consent: boolean | undefined,
  who: string,
  now: string,
): { consent_date?: string; consent_source?: string } {
  if (consent !== true || prev.marketing_consent) return {};
  return {
    consent_date: prev.consent_date ?? now,
    consent_source: prev.consent_source ?? `Recorded in the studio by ${who}`,
  };
}

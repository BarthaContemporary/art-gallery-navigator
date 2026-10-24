/*
 * Small, pure checks shared by the public website's form routes
 * (app/api/enquiry, booking, newsletter, offer/*, o/[token]/respond).
 * Kept free of Next and path aliases so `node --test` can run
 * form-fields.test.ts against this file directly.
 */

/**
 * A single-line field (a name, an email, a phone number, an address line, a
 * subject): no line breaks, tabs or other control characters, and none of the
 * Unicode line and paragraph separators. The site's own <input> fields cannot
 * produce them, so only a hand-made request is refused. A carriage return
 * left inside such a value starts a new row in a CSV export opened in a
 * spreadsheet, where the next cell can then run as a formula (security review
 * 2026-10, F9); a line break in a name also lands in email subjects and
 * calendar invitations.
 */
export const ONE_LINE = /^[^\u0000-\u001f\u007f\u2028\u2029]*$/;
export const ONE_LINE_MESSAGE = "Please keep names, addresses and other short fields on one line.";

/**
 * The visitor's IP address as Vercel reports it: `x-real-ip`, or the first
 * entry of `x-forwarded-for`. Vercel sets both at its edge and overwrites
 * whatever the browser sent, so neither can be forged. `cf-connecting-ip` is
 * never read: the site is not behind Cloudflare, so that header comes from
 * the visitor. Null when neither header holds something shaped like an
 * address (local development).
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const candidates = [headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip)) return ip;
  }
  return null;
}

/**
 * A safe short form of a visitor-typed name for an email greeting: the first
 * word, letters (any script), apostrophes and hyphens only, at most 30
 * characters. Anything else (a link, a domain, a sentence) is dropped, so a
 * stranger cannot have the gallery's own address mail their text to someone.
 * Null when nothing usable is left; the caller then greets without a name.
 */
export function greetingName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}\p{M}'’-]{1,30}$/u.test(first)) return null;
  if (!/\p{L}/u.test(first)) return null;
  return first;
}

/**
 * An email typed into a form as an exact ILIKE pattern: `%`, `_` and `\` are
 * escaped so they match only themselves, and `*` (which PostgREST reads as
 * `%`) too. Used only as the fallback when contact_id_by_email() is not yet
 * on the database (lib/contacts.ts).
 */
export function exactLikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, (c) => `\\${c}`);
}

/** Offer recipient tokens: hex from the database default, never anything wider. */
export const OFFER_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

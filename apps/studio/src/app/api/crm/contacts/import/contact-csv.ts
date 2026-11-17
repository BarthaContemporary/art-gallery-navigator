/**
 * Reading a contacts CSV: the header names it accepts and how a cell is
 * cleaned. Kept apart from the route so node --test runs it directly
 * (self-contained on purpose: no imports).
 */

/**
 * Canonical column -> accepted header names, compared after normaliseHeader.
 * The studio's own exports must come back in: contacts.csv writes the column
 * names (first_name, address_line1, contact_type, …) and contacts.xlsx the
 * pretty headers ("Address line1"), which used to match nothing, so a
 * re-import created contacts without names or addresses.
 *
 * "title" is not a salutation: the salutation is the whole greeting line
 * ("Dear Professor Tanaka"), and an Outlook "Title" column holds an honorific
 * (Mr, Dr) or, from a sales CRM, a job title, which newsletters then printed
 * as the greeting ("Dr," or "Curator,"). A Title column is left out, and
 * named in the reply.
 */
export const ALIASES: Record<string, string[]> = {
  first_name: ["first name", "firstname", "first", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address", "e-mail address"],
  phone: ["phone", "telephone", "tel", "mobile"],
  contact_type: ["type", "contact type"],
  salutation: ["salutation"],
  address_line1: ["address", "address line 1", "address line1", "address1", "address 1", "street"],
  address_line2: ["address line 2", "address line2", "address2", "address 2"],
  city: ["city", "town"],
  postcode: ["postcode", "post code", "zip", "zip code", "postal code"],
  country: ["country"],
  instagram_handle: ["instagram", "instagram handle", "ig"],
  notes: ["notes", "note"],
};

/**
 * A header as compared: trimmed (which also drops a byte-order mark),
 * lower-cased, underscores and runs of whitespace as one space.
 */
export function normaliseHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
}

export type HeaderMap = {
  /** For each column of the file, the contact column it fills, or null. */
  columns: (string | null)[];
  /** The headers that matched nothing, as written in the file (empty ones left out). */
  ignored: string[];
};

export function mapHeaders(headerRow: readonly string[]): HeaderMap {
  const ignored: string[] = [];
  const columns = headerRow.map((raw) => {
    const h = normaliseHeader(raw);
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(h)) return canonical;
    }
    if (h) ignored.push(raw.replace(/^﻿/, "").trim());
    return null;
  });
  return { columns, ignored };
}

/** True when the file has something to tell contacts apart by: a name or an email. */
export function hasIdentityColumn(columns: readonly (string | null)[]): boolean {
  return columns.some((c) => c === "first_name" || c === "last_name" || c === "email");
}

/**
 * A cell's value as stored. The studio's CSV export puts an apostrophe in
 * front of text a spreadsheet would run as a formula (lib/csv.ts), so every
 * phone number written "+44 …" comes back as "'+44 …"; that one apostrophe
 * is taken off again. An apostrophe before anything else is the person's own.
 */
export function cleanCell(value: string): string {
  const v = value.trim();
  return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
}

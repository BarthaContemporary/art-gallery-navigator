/**
 * Name matching for the UK Sanctions List screen (api/cron/sanctions-screen).
 * A screening aid: every hit is reviewed by a person, so the test leans
 * towards flagging. Pure and self-contained (no imports) so `node --test`
 * runs it directly.
 */

const NAMED_ENTITIES: Record<string, string> = { amp: "&", apos: "'", quot: '"', lt: "<", gt: ">" };

/** Text from the list's XML with its entities decoded, once (`&amp;apos;` stays `&apos;`). */
export function decodeXmlText(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|apos|quot|lt|gt);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
    const n = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

/** Lower case, accents dropped, and anything but letters and digits a space, so hyphens and apostrophes split words. */
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ScreeningTarget = {
  id: string;
  /** As entered, for the alert. */
  name: string;
  /** The first given name that is more than an initial. */
  given: string;
  /** Every word of the surname ("al assad", "van den bergh", "o brien"). */
  surname: string[];
};

/**
 * A contact as the screen looks for it, or null when the name is too short
 * to screen without noise (under 2 letters of first name or 3 of surname).
 * Only the first given name counts: a contact entered as "Igor Ivanovich"
 * must still meet a designation, or an alias, listed as "Igor SECHIN".
 */
export function screeningTarget(c: { id: string; first_name: string | null; last_name: string | null }): ScreeningTarget | null {
  const first = normName(c.first_name ?? "");
  const last = normName(c.last_name ?? "");
  if (first.length < 2 || last.length < 3) return null;
  const givenNames = first.split(" ");
  return {
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" "),
    given: givenNames.find((w) => w.length >= 2) ?? givenNames[0]!,
    surname: last.split(" "),
  };
}

/** True when a sanctioned name holds the contact's given name and every word of the surname. */
export function nameMatches(t: ScreeningTarget, words: ReadonlySet<string>): boolean {
  return words.has(t.given) && t.surname.every((w) => words.has(w));
}

export type DesignationName = {
  /** The name parts as the list gives them, joined. */
  name: string;
  /** Its words, normalised. */
  words: Set<string>;
  regime: string;
  uid: string;
};

/** Every name (aliases included) of every designation in the UK Sanctions List XML. */
export function designationNames(xml: string): DesignationName[] {
  const out: DesignationName[] = [];
  for (const d of xml.matchAll(/<Designation>([\s\S]*?)<\/Designation>/g)) {
    const inner = d[1] ?? "";
    const regime = decodeXmlText(/<RegimeName>([^<]*)<\/RegimeName>/.exec(inner)?.[1]?.trim() ?? "");
    const uid = decodeXmlText(/<UniqueID>([^<]*)<\/UniqueID>/.exec(inner)?.[1]?.trim() ?? "");
    for (const block of inner.matchAll(/<Name>([\s\S]*?)<\/Name>/g)) {
      const parts: string[] = [];
      for (const p of (block[1] ?? "").matchAll(/<Name[1-6]>([^<]*)<\/Name[1-6]>/g)) {
        const part = decodeXmlText(p[1] ?? "").trim();
        if (part) parts.push(part);
      }
      if (parts.length === 0) continue;
      const name = parts.join(" ");
      const words = new Set(normName(name).split(" ").filter(Boolean));
      if (words.size > 0) out.push({ name, words, regime, uid });
    }
  }
  return out;
}

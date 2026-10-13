/**
 * BCP 47 language for a maker's name in its original script, so the browser
 * picks the right face and glyph forms: Japanese kanji drawn as Chinese forms
 * read wrong, and the font stack (tokens.css) relies on lang to reach the
 * platform's Japanese face. Same rules as the website's
 * apps/web/src/lib/script-lang.ts; undefined for Latin or unrecognised text.
 */
export function scriptLang(text: string | null | undefined): string | undefined {
  const s = text ?? "";
  if (/[぀-ヿ一-鿿㐀-䶿]/.test(s)) return "ja";
  if (/[ऀ-ॿ]/.test(s)) return "hi";
  if (/[ঀ-৿]/.test(s)) return "bn";
  if (/[஀-௿]/.test(s)) return "ta";
  if (/[가-힯]/.test(s)) return "ko";
  return undefined;
}

/**
 * lang for a field where a native name is typed: follows what is there, and
 * is Japanese while the field is empty, as most makers' native names are.
 */
export function nativeFieldLang(value: string | null | undefined): string {
  return scriptLang(value) ?? "ja";
}

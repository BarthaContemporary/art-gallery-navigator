/**
 * The language a native-script name is most likely in, for `lang` on the
 * span that shows it, so screen readers switch voice: kana or kanji read as
 * Japanese, Devanagari as Hindi, Bengali and Tamil as themselves. Latin
 * text gets nothing and inherits the page language.
 */
export function scriptLang(text: string | null | undefined): string | undefined {
  const s = text ?? "";
  if (/[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test(s)) return "ja";
  if (/[\u0900-\u097f]/.test(s)) return "hi";
  if (/[\u0980-\u09ff]/.test(s)) return "bn";
  if (/[\u0b80-\u0bff]/.test(s)) return "ta";
  if (/[\uac00-\ud7af]/.test(s)) return "ko";
  return undefined;
}

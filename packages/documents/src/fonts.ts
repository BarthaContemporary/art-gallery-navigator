import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

/*
 * Embedded fonts for the PDF documents (certificate, fact sheet, labels).
 *
 * The PDF standard fonts (Helvetica, Times) are WinAnsi only: a macron or a
 * kanji came out as a different glyph ("Yoneda Bishō" printed "Yoneda
 * BishM"). These are Noto (SIL Open Font License, fonts/OFL-*.txt), with
 * Noto Sans JP as the fallback for every character the Latin fonts lack
 * (kana, kanji, CJK punctuation). react-pdf embeds only the glyphs a document
 * uses, so a PDF grows by tens of kilobytes, not by the font files' size.
 * fonts/README.md says where the files come from and how they were cut down.
 *
 * Where the files are at run time:
 * - unbundled (unit tests, scripts, `next dev`): ../fonts beside this file;
 * - the studio on Vercel: apps/studio/next.config.ts traces the folder into
 *   the /api/export routes (outputFileTracingIncludes), at the same place
 *   relative to the repository root, and the function runs in apps/studio.
 * If none is found the documents fall back to the standard fonts, as before,
 * with a warning in the log, rather than failing to render.
 */

export const FONT_FILES = {
  sansRegular: "NotoSans-Regular.ttf",
  sansBold: "NotoSans-Bold.ttf",
  sansItalic: "NotoSans-Italic.ttf",
  serifRegular: "NotoSerif-Regular.ttf",
  serifBold: "NotoSerif-Bold.ttf",
  serifItalic: "NotoSerif-Italic.ttf",
  cjk: "NotoSansJP-Regular.ttf",
} as const;

function moduleFontDir(): string | null {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
  } catch {
    return null;
  }
}

/** The first folder that holds every font file, or null. */
export function findFontDir(cwd: string = process.cwd()): string | null {
  const candidates = [
    moduleFontDir(),
    join(cwd, "..", "..", "packages", "documents", "fonts"), // apps/<app>
    join(cwd, "packages", "documents", "fonts"), // repository root
    join(cwd, "node_modules", "@jvb", "documents", "fonts"),
  ];
  for (const dir of candidates) {
    if (dir && Object.values(FONT_FILES).every((f) => existsSync(join(dir, f)))) return dir;
  }
  return null;
}

const SANS_FAMILY = "Noto Sans";
const SERIF_FAMILY = "Noto Serif";
const CJK_FAMILY = "Noto Sans JP";

function register(dir: string): void {
  const at = (f: string) => join(dir, f);
  Font.register({
    family: SANS_FAMILY,
    fonts: [
      { src: at(FONT_FILES.sansRegular), fontWeight: 400, fontStyle: "normal" },
      { src: at(FONT_FILES.sansBold), fontWeight: 700, fontStyle: "normal" },
      { src: at(FONT_FILES.sansItalic), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: SERIF_FAMILY,
    fonts: [
      { src: at(FONT_FILES.serifRegular), fontWeight: 400, fontStyle: "normal" },
      { src: at(FONT_FILES.serifBold), fontWeight: 700, fontStyle: "normal" },
      { src: at(FONT_FILES.serifItalic), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  // One weight, registered for both styles: react-pdf resolves every family
  // of a fallback list for the run's weight and style and throws when a
  // style has no source at all. Japanese has no italic; bold falls back to
  // this regular.
  Font.register({
    family: CJK_FAMILY,
    fonts: [
      { src: at(FONT_FILES.cjk), fontWeight: 400, fontStyle: "normal" },
      { src: at(FONT_FILES.cjk), fontWeight: 400, fontStyle: "italic" },
    ],
  });
}

const fontDir = findFontDir();
if (fontDir) {
  register(fontDir);
} else {
  console.warn(
    "[@jvb/documents] PDF fonts not found; using the standard PDF fonts, which cannot print macrons or Japanese",
  );
}

/** True when the Noto fonts are registered (false: standard-font fallback). */
export const EMBEDDED_FONTS = fontDir !== null;

/**
 * fontFamily values for the PDF styles. Use fontWeight 700 / fontStyle
 * "italic" for bold and italic, never a "-Bold" family name: both the Noto
 * families and the standard-font fallback resolve weight and style.
 */
export const SANS: string | string[] = fontDir ? [SANS_FAMILY, CJK_FAMILY] : "Helvetica";
export const SERIF: string | string[] = fontDir ? [SERIF_FAMILY, CJK_FAMILY] : "Times-Roman";

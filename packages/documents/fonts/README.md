# PDF fonts

Embedded by `src/fonts.ts` in the certificate, fact sheet and label PDFs.
All are under the SIL Open Font License 1.1 (`OFL-*.txt` here); the cut-down
files below are Modified Versions under that licence and keep the Noto names
(no Reserved Font Name is used).

| File | Size | From |
|---|---|---|
| NotoSans-Regular.ttf | 211,804 | Noto Sans 400 |
| NotoSans-Bold.ttf | 212,724 | Noto Sans 700 |
| NotoSans-Italic.ttf | 212,188 | Noto Sans 400 italic |
| NotoSerif-Regular.ttf | 232,480 | Noto Serif 400 |
| NotoSerif-Bold.ttf | 233,296 | Noto Serif 700 |
| NotoSerif-Italic.ttf | 238,664 | Noto Serif 400 italic |
| NotoSansJP-Regular.ttf | 5,634,636 | Noto Sans JP 400 (all of its characters) |

About 7 MB in all. They live only in the studio's PDF export functions
(`apps/studio/next.config.ts`, `outputFileTracingIncludes`); a PDF embeds just
the glyphs it uses, so a certificate is about 18 KB.

Source: the Google Fonts static instances as packaged on npm by
`@expo-google-fonts/noto-sans@0.4.2`, `@expo-google-fonts/noto-serif@0.4.2`
and `@expo-google-fonts/noto-sans-jp@0.4.4` (Noto Sans JP v57). Cut down with
fontTools 4.68 `pyftsubset`, hinting removed:

```sh
# Latin files: Latin, Latin-1, Extended-A/B and Additional (IAST and
# Hepburn romanisation: ā ī ū ṛ ṣ ṅ, ō ū), combining marks, Greek, general
# punctuation, currency, letterlike symbols, number forms, arrows, maths
U="U+0000-024F,U+0250-02FF,U+0300-036F,U+0370-03FF,U+1E00-1EFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F,U+2150-218F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2E00-2E7F,U+FB00-FB06,U+FEFF,U+FFFD"
pyftsubset NotoSans_400Regular.ttf --unicodes="$U" --no-hinting --layout-features='*' \
  --name-IDs='*' --notdef-outline --drop-tables+=DSIG --output-file=NotoSans-Regular.ttf
# (the same for the other Latin files)

# Japanese: every character kept; hinting and vertical metrics dropped
pyftsubset NotoSansJP_400Regular.ttf --unicodes='*' --no-hinting \
  --drop-tables+=vmtx,vhea,VORG,DSIG --name-IDs='*' --notdef-outline \
  --output-file=NotoSansJP-Regular.ttf
```

Anything the Latin files lack falls back to Noto Sans JP, which also covers
Cyrillic and most symbols. A Mincho (Noto Serif JP, about 8 MB more) could be
added for Japanese inside the certificate's serif text; today Japanese prints
in the sans everywhere.

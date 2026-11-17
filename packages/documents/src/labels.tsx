import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { SANS } from "./fonts";
import { fitLabel, labelHyphenation, mailingLabelLines, type LabelAddress, type LabelFit, type LabelText } from "./label-fit";

export type { LabelAddress } from "./label-fit";

/** Avery layouts — dimensions in mm converted to points (1 mm = 2.8346 pt). */
const AVERY = {
  L7160: { cols: 3, rows: 7, labelW: 63.5, labelH: 38.1, marginTop: 15.1, marginLeft: 7.2, gutterX: 2.5, gutterY: 0 },
  L7162: { cols: 2, rows: 8, labelW: 99.1, labelH: 33.9, marginTop: 12.9, marginLeft: 4.65, gutterX: 2.5, gutterY: 0 },
  L7163: { cols: 2, rows: 7, labelW: 99.1, labelH: 38.1, marginTop: 15.1, marginLeft: 4.65, gutterX: 2.5, gutterY: 0 },
} as const;

export type AveryTemplate = keyof typeof AVERY;

const MM = 2.8346;
/** Inner margin of a label: clear of the die-cut's rounded corners. */
const PAD_Y_MM = 4;
const PAD_X_MM = 5;

const s = StyleSheet.create({
  page: { fontFamily: SANS, fontSize: 9.5, color: "#1f1f1f" },
  label: { position: "absolute", padding: `${PAD_Y_MM * MM} ${PAD_X_MM * MM}`, overflow: "hidden" },
});

/** The label's text area in points, inside the padding. */
function contentBox(t: (typeof AVERY)[AveryTemplate]) {
  return { width: (t.labelW - 2 * PAD_X_MM) * MM, height: (t.labelH - 2 * PAD_Y_MM) * MM };
}

/**
 * One text's style at the fitted size. Each style states its own size and
 * its leading in points: a unitless lineHeight is taken against the style's
 * own fontSize (18 pt when it has none), not the inherited one, which set the
 * lines 24 pt apart and printed wrapped lines over the next. flexShrink 0
 * keeps the lines from being squeezed together when a label is full.
 */
function textStyle(fit: LabelFit, t: LabelText, i: number) {
  const size = fit.fontSize * (t.scale ?? 1);
  return {
    fontSize: size,
    lineHeight: `${(size * fit.leading).toFixed(2)}pt`,
    flexShrink: 0,
    maxLines: fit.maxLines[i],
    textOverflow: "ellipsis" as const,
    ...(t.bold ? { fontWeight: 700 as const } : {}),
  };
}

function LabelBody({
  texts,
  box,
  extra,
}: {
  texts: LabelText[];
  box: { width: number; height: number };
  /** Further style for the i-th text (italic title, grey size line). */
  extra?: (i: number) => { fontStyle?: "italic"; color?: string } | undefined;
}) {
  const fit = fitLabel(texts, box);
  return (
    // Centred when everything fits; otherwise from the top, so what is cut
    // off is the end of the label, never the addressee or the stock number.
    <View style={{ flexGrow: 1, justifyContent: fit.fits ? "center" : "flex-start" }}>
      {texts.map((t, i) => (
        <Text
          key={i}
          hyphenationCallback={labelHyphenation}
          style={[textStyle(fit, t, i), extra?.(i) ?? {}]}
        >
          {t.text}
        </Text>
      ))}
    </View>
  );
}

/**
 * Postal mailing labels on Avery stock. UK format by default; the country
 * line is appended (uppercase) only for non-UK addresses.
 */
export function MailingLabels({
  addresses,
  template = "L7160",
}: {
  addresses: LabelAddress[];
  template?: AveryTemplate;
}) {
  const t = AVERY[template];
  const box = contentBox(t);
  const perPage = t.cols * t.rows;
  const pages: LabelAddress[][] = [];
  for (let i = 0; i < addresses.length; i += perPage) {
    pages.push(addresses.slice(i, i + perPage));
  }

  return (
    <Document>
      {pages.map((page, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          {page.map((a, i) => {
            const col = i % t.cols;
            const row = Math.floor(i / t.cols);
            const left = (t.marginLeft + col * (t.labelW + t.gutterX)) * MM;
            const top = (t.marginTop + row * (t.labelH + t.gutterY)) * MM;
            const texts = mailingLabelLines(a).map((text) => ({ text, maxLines: 2 }));
            return (
              <View
                key={i}
                style={[s.label, { left, top, width: t.labelW * MM, height: t.labelH * MM }]}
              >
                <LabelBody texts={texts} box={box} />
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}

export interface WorkLabel {
  stockNumber: string;
  maker?: string;
  /** Title with its year, e.g. "Reclining Figure, 2026". */
  title: string;
  /** Full dimension line — framed and unframed together when framed. */
  dimensions?: string;
}

/**
 * Object labels for works, on the same Avery stock as the mailing labels —
 * for the backs of frames, storage boxes and crates. Stock number leads so a
 * label can be matched to its record at a glance; the dimension line carries
 * the framed and unframed sizes together.
 */
export function WorkLabels({
  works,
  template = "L7163",
}: {
  works: WorkLabel[];
  template?: AveryTemplate;
}) {
  const t = AVERY[template];
  const box = contentBox(t);
  const perPage = t.cols * t.rows;
  const pages: WorkLabel[][] = [];
  for (let i = 0; i < works.length; i += perPage) {
    pages.push(works.slice(i, i + perPage));
  }
  const small = 8 / 9.5;

  return (
    <Document>
      {pages.map((page, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          {page.map((w, i) => {
            const col = i % t.cols;
            const row = Math.floor(i / t.cols);
            const left = (t.marginLeft + col * (t.labelW + t.gutterX)) * MM;
            const top = (t.marginTop + row * (t.labelH + t.gutterY)) * MM;
            const texts: LabelText[] = [{ text: w.stockNumber, scale: small, bold: true, maxLines: 1 }];
            if (w.maker) texts.push({ text: w.maker, maxLines: 2 });
            const titleAt = texts.length;
            texts.push({ text: w.title, maxLines: 3 });
            if (w.dimensions) texts.push({ text: w.dimensions, scale: small, maxLines: 2 });
            const dimsAt = w.dimensions ? texts.length - 1 : -1;
            return (
              <View
                key={i}
                style={[s.label, { left, top, width: t.labelW * MM, height: t.labelH * MM }]}
              >
                <LabelBody
                  texts={texts}
                  box={box}
                  extra={(n) => (n === titleAt ? { fontStyle: "italic" } : n === dimsAt ? { color: "#3a3a3a" } : undefined)}
                />
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}

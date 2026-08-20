import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface LabelAddress {
  name: string;
  organization?: string;
  lines: string[];
  city?: string;
  postcode?: string;
  country?: string;
}

/** Avery layouts — dimensions in mm converted to points (1 mm = 2.8346 pt). */
const AVERY = {
  L7160: { cols: 3, rows: 7, labelW: 63.5, labelH: 38.1, marginTop: 15.1, marginLeft: 7.2, gutterX: 2.5, gutterY: 0 },
  L7162: { cols: 2, rows: 8, labelW: 99.1, labelH: 33.9, marginTop: 12.9, marginLeft: 4.65, gutterX: 2.5, gutterY: 0 },
  L7163: { cols: 2, rows: 7, labelW: 99.1, labelH: 38.1, marginTop: 15.1, marginLeft: 4.65, gutterX: 2.5, gutterY: 0 },
} as const;

export type AveryTemplate = keyof typeof AVERY;

const MM = 2.8346;

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: "#1f1f1f" },
  label: { position: "absolute", padding: `${4 * MM} ${5 * MM}`, justifyContent: "center", overflow: "hidden" },
  line: { lineHeight: 1.35 },
  stock: { fontFamily: "Helvetica-Bold", fontSize: 8, lineHeight: 1.35 },
  workTitle: { fontFamily: "Helvetica-Oblique", lineHeight: 1.35 },
  dims: { fontSize: 8, lineHeight: 1.35, color: "#3a3a3a" },
});

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
            const isUk =
              !a.country || /^(uk|united kingdom|great britain|england|scotland|wales)$/i.test(a.country);
            return (
              <View
                key={i}
                style={[s.label, { left, top, width: t.labelW * MM, height: t.labelH * MM }]}
              >
                <Text style={s.line}>{a.name}</Text>
                {a.organization ? <Text style={s.line}>{a.organization}</Text> : null}
                {a.lines.filter(Boolean).map((l, li) => (
                  <Text key={li} style={s.line}>
                    {l}
                  </Text>
                ))}
                <Text style={s.line}>
                  {[a.city, a.postcode].filter(Boolean).join("  ")}
                </Text>
                {!isUk && a.country ? (
                  <Text style={s.line}>{a.country.toUpperCase()}</Text>
                ) : null}
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
  const perPage = t.cols * t.rows;
  const pages: WorkLabel[][] = [];
  for (let i = 0; i < works.length; i += perPage) {
    pages.push(works.slice(i, i + perPage));
  }

  return (
    <Document>
      {pages.map((page, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          {page.map((w, i) => {
            const col = i % t.cols;
            const row = Math.floor(i / t.cols);
            const left = (t.marginLeft + col * (t.labelW + t.gutterX)) * MM;
            const top = (t.marginTop + row * (t.labelH + t.gutterY)) * MM;
            return (
              <View
                key={i}
                style={[s.label, { left, top, width: t.labelW * MM, height: t.labelH * MM }]}
              >
                <Text style={s.stock}>{w.stockNumber}</Text>
                {w.maker ? <Text style={s.line}>{w.maker}</Text> : null}
                <Text style={s.workTitle}>{w.title}</Text>
                {w.dimensions ? <Text style={s.dims}>{w.dimensions}</Text> : null}
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}

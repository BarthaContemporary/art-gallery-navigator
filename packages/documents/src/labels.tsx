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
  label: { position: "absolute", padding: `${4 * MM} ${5 * MM}`, justifyContent: "center" },
  line: { lineHeight: 1.35 },
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

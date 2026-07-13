import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface FactSheetWork {
  stockNumber: string;
  title: string;
  maker?: string;
  makerLifeDates?: string;
  period?: string;
  originRegion?: string;
  medium?: string;
  dimensionsDisplay?: string;
  description?: string;
  signatureInscription?: string;
  provenance?: { dateText?: string; text: string }[];
  imageUrl?: string;
  priceDisplay?: string;
}

export interface FactSheetProps {
  galleryName: string;
  galleryAddress?: string;
  works: FactSheetWork[];
  showPrices?: boolean;
}

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, color: "#2f2f2f", fontFamily: "Helvetica" },
  header: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#8a8a8a",
    marginBottom: 24,
  },
  stock: { fontSize: 8.5, color: "#8a8a8a", marginBottom: 6 },
  maker: { fontSize: 11, color: "#5f5f5f", marginBottom: 2 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#1f1f1f", marginBottom: 2 },
  sub: { fontSize: 10.5, color: "#5f5f5f", marginBottom: 14 },
  image: { maxHeight: 300, objectFit: "contain", marginBottom: 16 },
  specRow: { flexDirection: "row", borderTop: "0.5 solid #dcdcdc", paddingVertical: 5 },
  specLabel: { width: 110, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#8a8a8a" },
  specValue: { flex: 1, fontSize: 10 },
  section: { marginTop: 14 },
  sectionLabel: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.8, color: "#8a8a8a", marginBottom: 4 },
  body: { fontSize: 10, lineHeight: 1.5, color: "#3a3a3a" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#9a9a9a",
    borderTop: "0.5 solid #dcdcdc",
    paddingTop: 8,
  },
});

/**
 * Per-work fact sheet — one page per work. Exported as PDF; the DOCX variant
 * (editable in Proton Docs) is generated from the same data in docx.ts.
 */
export function FactSheet({ galleryName, galleryAddress, works, showPrices }: FactSheetProps) {
  return (
    <Document>
      {works.map((w) => (
        <Page key={w.stockNumber} size="A4" style={s.page}>
          <Text style={s.header}>{galleryName}</Text>
          <Text style={s.stock}>STOCK {w.stockNumber}</Text>
          {w.maker ? (
            <Text style={s.maker}>
              {w.maker}
              {w.makerLifeDates ? ` (${w.makerLifeDates})` : ""}
            </Text>
          ) : null}
          <Text style={s.title}>{w.title}</Text>
          <Text style={s.sub}>
            {[w.period, w.originRegion].filter(Boolean).join(" · ")}
          </Text>
          {w.imageUrl ? <Image src={w.imageUrl} style={s.image} /> : null}
          {[
            ["Medium", w.medium],
            ["Dimensions", w.dimensionsDisplay],
            ["Signature", w.signatureInscription],
            showPrices && w.priceDisplay ? ["Price", w.priceDisplay] : null,
          ]
            .filter((r): r is [string, string] => Boolean(r && r[1]))
            .map(([label, value]) => (
              <View key={label} style={s.specRow}>
                <Text style={s.specLabel}>{label}</Text>
                <Text style={s.specValue}>{value}</Text>
              </View>
            ))}
          {w.description ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Description</Text>
              <Text style={s.body}>{w.description}</Text>
            </View>
          ) : null}
          {w.provenance && w.provenance.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Provenance</Text>
              {w.provenance.map((p, i) => (
                <Text key={i} style={s.body}>
                  {p.dateText ? `${p.dateText} — ` : ""}
                  {p.text}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={s.footer} fixed>
            {galleryName}
            {galleryAddress ? ` · ${galleryAddress}` : ""}
          </Text>
        </Page>
      ))}
    </Document>
  );
}

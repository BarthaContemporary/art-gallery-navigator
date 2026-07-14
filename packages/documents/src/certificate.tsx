import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface CertificateWork {
  stockNumber: string;
  title: string;
  maker?: string;
  makerLifeDates?: string;
  period?: string;
  originRegion?: string;
  medium?: string;
  dimensionsDisplay?: string;
  signatureInscription?: string;
  provenance?: { dateText?: string; text: string }[];
  imageUrl?: string;
}

export interface CertificateProps {
  galleryName: string;
  galleryAddress?: string;
  work: CertificateWork;
  /** Verbatim date string, e.g. "14 July 2026". */
  issuedDate: string;
  signatoryName?: string;
  signatoryRole?: string;
}

const s = StyleSheet.create({
  page: { padding: 56, fontSize: 11, color: "#2a2a2a", fontFamily: "Times-Roman" },
  wordmark: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#8a8a8a",
    fontFamily: "Helvetica",
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Times-Roman",
    textAlign: "center",
    marginTop: 28,
    marginBottom: 4,
  },
  rule: { borderBottom: "0.75 solid #c9c9c9", width: 80, alignSelf: "center", marginBottom: 26 },
  lede: { fontSize: 11.5, lineHeight: 1.6, textAlign: "center", marginBottom: 24, color: "#3a3a3a" },
  image: { maxHeight: 240, objectFit: "contain", marginBottom: 22, alignSelf: "center" },
  makerLine: { fontSize: 13, textAlign: "center", color: "#3a3a3a" },
  workTitle: { fontSize: 16, fontFamily: "Times-Bold", textAlign: "center", marginTop: 2 },
  workSub: { fontSize: 11, textAlign: "center", color: "#5f5f5f", marginTop: 3, marginBottom: 20 },
  specRow: { flexDirection: "row", borderTop: "0.5 solid #dcdcdc", paddingVertical: 5 },
  specLabel: {
    width: 120,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#8a8a8a",
  },
  specValue: { flex: 1, fontSize: 10.5 },
  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#8a8a8a",
    marginBottom: 4,
  },
  body: { fontSize: 10.5, lineHeight: 1.5, color: "#3a3a3a" },
  signBlock: { marginTop: 56, flexDirection: "row", justifyContent: "space-between" },
  signCol: { width: "45%" },
  signLine: { borderTop: "0.75 solid #6a6a6a", paddingTop: 5, fontSize: 9, color: "#6f6f6f", fontFamily: "Helvetica" },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#9a9a9a",
    textAlign: "center",
  },
});

/** Certificate of authenticity — one work per page. PDF; DOCX in docx.ts. */
export function Certificate({
  galleryName,
  galleryAddress,
  work,
  issuedDate,
  signatoryName,
  signatoryRole,
}: CertificateProps) {
  const specs: [string, string | undefined][] = [
    ["Medium", work.medium],
    ["Dimensions", work.dimensionsDisplay],
    ["Signature", work.signatureInscription],
    ["Stock number", work.stockNumber],
  ];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>{galleryName}</Text>
        <Text style={s.title}>Certificate of Authenticity</Text>
        <View style={s.rule} />
        <Text style={s.lede}>
          This is to certify that the work described below is, to the best of our
          knowledge and belief, authentic as catalogued.
        </Text>

        {work.imageUrl ? <Image src={work.imageUrl} style={s.image} /> : null}

        {work.maker ? (
          <Text style={s.makerLine}>
            {work.maker}
            {work.makerLifeDates ? ` (${work.makerLifeDates})` : ""}
          </Text>
        ) : null}
        <Text style={s.workTitle}>{work.title}</Text>
        <Text style={s.workSub}>
          {[work.period, work.originRegion].filter(Boolean).join(" · ")}
        </Text>

        {specs
          .filter((r): r is [string, string] => Boolean(r[1]))
          .map(([label, value]) => (
            <View key={label} style={s.specRow}>
              <Text style={s.specLabel}>{label}</Text>
              <Text style={s.specValue}>{value}</Text>
            </View>
          ))}

        {work.provenance && work.provenance.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Provenance</Text>
            {work.provenance.map((p, i) => (
              <Text key={i} style={s.body}>
                {p.dateText ? `${p.dateText} — ` : ""}
                {p.text}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={s.signBlock}>
          <View style={s.signCol}>
            <Text style={s.signLine}>
              {signatoryName ?? galleryName}
              {signatoryRole ? `, ${signatoryRole}` : ""}
            </Text>
          </View>
          <View style={s.signCol}>
            <Text style={s.signLine}>Issued {issuedDate}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          {galleryName}
          {galleryAddress ? ` · ${galleryAddress}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

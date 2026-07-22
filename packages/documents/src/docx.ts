import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { FactSheetWork } from "./fact-sheet";
import type { CertificateWork } from "./certificate";

/*
 * DOCX variants of the fact sheet and certificate — editable in Proton Docs
 * / Word. Text only (no embedded imagery) so they stay light and editable;
 * the PDF variants carry the photography.
 */

const LABEL = "8A8A8A";
const INK = "2A2A2A";

function specParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label.toUpperCase()}   `, color: LABEL, size: 17, bold: true }),
      new TextRun({ text: value, color: INK, size: 21 }),
    ],
  });
}

function specs(
  rows: [string, string | undefined | null][],
): Paragraph[] {
  return rows
    .filter((r): r is [string, string] => Boolean(r[1]))
    .map(([label, value]) => specParagraph(label, value));
}

function factSheetSection(w: FactSheetWork, showPrices: boolean): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `STOCK ${w.stockNumber}`, color: LABEL, size: 16 })],
    }),
  );
  if (w.maker) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${w.maker}${w.makerLifeDates ? ` (${w.makerLifeDates})` : ""}`,
            color: "5F5F5F",
            size: 22,
          }),
        ],
      }),
    );
  }
  out.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      children: [new TextRun({ text: w.title, bold: true, size: 32, color: INK })],
    }),
  );
  const sub = [w.period, w.originRegion].filter(Boolean).join(" · ");
  if (sub) {
    out.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: sub, color: "5F5F5F", size: 21 })],
      }),
    );
  }
  out.push(
    ...specs([
      ["Medium", w.medium],
      ["Dimensions", w.dimensionsDisplay],
      ["Signature", w.signatureInscription],
      showPrices ? ["Price", w.priceDisplay] : null,
    ].filter(Boolean) as [string, string | undefined][]),
  );
  if (w.description) {
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 40 },
        children: [new TextRun({ text: "DESCRIPTION", color: LABEL, bold: true, size: 17 })],
      }),
      new Paragraph({ children: [new TextRun({ text: w.description, size: 21, color: "3A3A3A" })] }),
    );
  }
  if (w.provenance && w.provenance.length > 0) {
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 40 },
        children: [new TextRun({ text: "PROVENANCE", color: LABEL, bold: true, size: 17 })],
      }),
      ...w.provenance.map(
        (p) =>
          new Paragraph({
            children: [
              new TextRun({
                text: `${p.dateText ? `${p.dateText} — ` : ""}${p.text}`,
                size: 21,
                color: "3A3A3A",
              }),
            ],
          }),
      ),
    );
  }
  return out;
}

export async function factSheetDocx(props: {
  galleryName: string;
  galleryAddress?: string;
  works: FactSheetWork[];
  showPrices?: boolean;
}): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: props.galleryName.toUpperCase(),
          color: LABEL,
          size: 18,
        }),
      ],
    }),
  ];
  props.works.forEach((w, i) => {
    if (i > 0) children.push(new Paragraph({ pageBreakBefore: true }));
    children.push(...factSheetSection(w, Boolean(props.showPrices)));
  });
  if (props.galleryAddress) {
    children.push(
      new Paragraph({
        spacing: { before: 320 },
        children: [
          new TextRun({
            text: `${props.galleryName} · ${props.galleryAddress}`,
            color: "9A9A9A",
            size: 16,
          }),
        ],
      }),
    );
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: "Helvetica" } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export async function certificateDocx(props: {
  galleryName: string;
  galleryAddress?: string;
  work: CertificateWork;
  issuedDate: string;
  signatoryName?: string;
  signatoryRole?: string;
}): Promise<Buffer> {
  const { work: w } = props;
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: props.galleryName.toUpperCase(), color: LABEL, size: 18 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text: "Certificate of Authenticity", size: 40, color: INK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: "This is to certify that the work described below is, to the best of our knowledge and belief, authentic as catalogued.",
          italics: true,
          size: 22,
          color: "3A3A3A",
        }),
      ],
    }),
  ];
  if (w.maker) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${w.maker}${w.makerLifeDates ? ` (${w.makerLifeDates})` : ""}`,
            size: 24,
            color: "3A3A3A",
          }),
        ],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: w.title, bold: true, size: 30, color: INK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: [w.period, w.originRegion].filter(Boolean).join(" · "),
          color: "5F5F5F",
          size: 21,
        }),
      ],
    }),
    ...specs([
      ["Medium", w.medium],
      ["Dimensions", w.dimensionsDisplay],
      ["Signature", w.signatureInscription],
      ["Stock number", w.stockNumber],
    ]),
  );
  if (w.provenance && w.provenance.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 40 },
        children: [new TextRun({ text: "PROVENANCE", color: LABEL, bold: true, size: 17 })],
      }),
      ...w.provenance.map(
        (p) =>
          new Paragraph({
            children: [
              new TextRun({
                text: `${p.dateText ? `${p.dateText} — ` : ""}${p.text}`,
                size: 21,
                color: "3A3A3A",
              }),
            ],
          }),
      ),
    );
  }
  children.push(
    new Paragraph({
      spacing: { before: 640 },
      children: [
        new TextRun({
          text: `${props.signatoryName ?? props.galleryName}${props.signatoryRole ? `, ${props.signatoryRole}` : ""}`,
          size: 20,
          color: "6F6F6F",
        }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Issued ${props.issuedDate}`, size: 20, color: "6F6F6F" })],
    }),
  );
  const doc = new Document({
    styles: { default: { document: { run: { font: "Helvetica" } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

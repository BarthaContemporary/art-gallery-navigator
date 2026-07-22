import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/*
 * Offer presentation DOCX — one work per page with its photograph embedded,
 * fully editable in Word / Pages / Proton Docs. Complements the tokenized
 * offer web page: this is the version the dealer can tweak and send by hand.
 */

const LABEL = "8A8A8A";
const INK = "2A2A2A";

export type PresentationWork = {
  stockNumber: string;
  title: string;
  maker?: string | null;
  makerLifeDates?: string | null;
  period?: string | null;
  originRegion?: string | null;
  medium?: string | null;
  dimensionsDisplay?: string | null;
  description?: string | null;
  priceDisplay?: string | null;
  note?: string | null;
  /** JPEG/PNG bytes of the display image, plus its pixel dimensions. */
  image?: { data: Buffer; type: "jpg" | "png"; width: number; height: number } | null;
};

// Fit inside a portrait A4 text block (~600px wide at 96dpi with margins).
const MAX_W = 560;
const MAX_H = 520;

function imageParagraph(img: NonNullable<PresentationWork["image"]>): Paragraph {
  const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new ImageRun({
        type: img.type,
        data: img.data,
        transformation: {
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
        },
      }),
    ],
  });
}

function workSection(w: PresentationWork): Paragraph[] {
  const out: Paragraph[] = [];
  if (w.image) out.push(imageParagraph(w.image));

  if (w.maker) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
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
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: w.title, bold: true, size: 30, color: INK })],
    }),
  );
  const sub = [w.period, w.originRegion].filter(Boolean).join(" · ");
  if (sub) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: sub, color: "5F5F5F", size: 20 })],
      }),
    );
  }
  const detail = [w.medium, w.dimensionsDisplay].filter(Boolean).join(" · ");
  if (detail) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: detail, color: "3A3A3A", size: 20 })],
      }),
    );
  }
  if (w.priceDisplay) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 40 },
        children: [new TextRun({ text: w.priceDisplay, bold: true, size: 24, color: INK })],
      }),
    );
  }
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: `Stock ${w.stockNumber}`, color: LABEL, size: 16 })],
    }),
  );
  if (w.description) {
    out.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: w.description, size: 21, color: "3A3A3A" })],
      }),
    );
  }
  if (w.note) {
    out.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: w.note, italics: true, size: 20, color: "5F5F5F" })],
      }),
    );
  }
  return out;
}

export async function offerPresentationDocx(props: {
  galleryName: string;
  galleryAddress?: string;
  title: string;
  intro?: string | null;
  works: PresentationWork[];
}): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: props.galleryName.toUpperCase(), color: LABEL, size: 18 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: props.intro ? 120 : 320 },
      children: [new TextRun({ text: props.title, bold: true, size: 36, color: INK })],
    }),
  ];
  if (props.intro) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 320 },
        children: [new TextRun({ text: props.intro, italics: true, size: 22, color: "3A3A3A" })],
      }),
    );
  }
  props.works.forEach((w, i) => {
    children.push(new Paragraph({ pageBreakBefore: i >= 0 }));
    children.push(...workSection(w));
  });
  if (props.galleryAddress) {
    children.push(
      new Paragraph({
        spacing: { before: 320 },
        alignment: AlignmentType.CENTER,
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

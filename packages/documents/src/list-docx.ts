import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";

/*
 * DOCX checklist for an inventory list — editable in Proton Docs / Word.
 *
 * A table, not a fact-sheet-per-page: this is the document you carry to a fair,
 * hand to a shipper, or mark up in a meeting. Text only, so it stays light and
 * genuinely editable; the fact sheet and presentation exports carry imagery.
 */

const LABEL = "8A8A8A";
const INK = "2A2A2A";
const RULE = "D9D9D9";

export type ListWork = {
  stock_number: string | null;
  title: string | null;
  maker_name: string | null;
  medium: string | null;
  period: string | null;
  status: string | null;
  location_code: string | null;
};

const COLUMNS: { header: string; width: number; get: (w: ListWork) => string }[] = [
  { header: "Stock", width: 14, get: (w) => w.stock_number ?? "—" },
  { header: "Title", width: 30, get: (w) => w.title ?? "Untitled" },
  { header: "Maker", width: 20, get: (w) => w.maker_name ?? "—" },
  {
    header: "Medium / period",
    width: 22,
    get: (w) => [w.medium, w.period].filter(Boolean).join(" · ") || "—",
  },
  { header: "Location", width: 14, get: (w) => w.location_code ?? "—" },
];

function cell(text: string, opts: { header?: boolean; width: number }): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: opts.header ? 16 : 18,
            bold: Boolean(opts.header),
            color: opts.header ? LABEL : INK,
          }),
        ],
      }),
    ],
  });
}

export async function listDocx(props: {
  galleryName: string;
  listName: string;
  subtitle?: string | null;
  works: ListWork[];
}): Promise<Buffer> {
  const header = new TableRow({
    tableHeader: true,
    children: COLUMNS.map((c) => cell(c.header.toUpperCase(), { header: true, width: c.width })),
  });

  const body = props.works.map(
    (w) =>
      new TableRow({
        children: COLUMNS.map((c) => cell(c.get(w), { width: c.width })),
      }),
  );

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: props.galleryName.toUpperCase(), color: LABEL, size: 18 })],
    }),
    new Paragraph({
      spacing: { before: 120, after: props.subtitle ? 40 : 240 },
      children: [new TextRun({ text: props.listName, bold: true, size: 32, color: INK })],
    }),
  ];

  if (props.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun({ text: props.subtitle, color: LABEL, size: 18 })],
      }),
    );
  }

  if (props.works.length === 0) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: "No works in this list.", color: LABEL, size: 18 })] }),
    );
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [header, ...body],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 320 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `${props.works.length} work${props.works.length === 1 ? "" : "s"} · ${props.galleryName}`,
          color: "9A9A9A",
          size: 16,
        }),
      ],
    }),
  );

  const doc = new Document({
    styles: { default: { document: { run: { font: "Helvetica" } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

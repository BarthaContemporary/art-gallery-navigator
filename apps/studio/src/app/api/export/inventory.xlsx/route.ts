import { exportResponse } from "@/lib/shared-drive";
import ExcelJS from "exceljs";
import { getSupabase } from "@/lib/supabase";
import { prettyHeader, cellValue, columnWidth, styleSheet } from "@/lib/xlsx-clean";
import { fetchExportThumbnails, IMAGE_CAP } from "@/lib/export-images";
import { applyInventoryFilters, EXPORT_COLUMNS, toExportRow } from "@/lib/inventory-query";

export const runtime = "nodejs";
// Embedding imagery makes this slow; give it room.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Inventory export — XLSX opens directly in Proton Sheets / Excel. */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const query = applyInventoryFilters(
    supabase.from("vw_pieces_list").select("*").order("stock_number"),
    url.searchParams,
  );
  const { data: rows, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const pieces = (rows ?? []).map((r) =>
    toExportRow(r as Record<string, unknown>),
  ) as (Record<string, unknown> & { id: string })[];
  const { images, omitted } = await fetchExportThumbnails(pieces.map((p) => p.id));

  const cols = [...EXPORT_COLUMNS];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventory");
  // Leading, empty column holds the thumbnail; ExcelJS anchors images to cells
  // rather than storing them in one.
  ws.columns = [
    { header: "", key: "__image", width: 14 },
    ...cols.map((c) => ({ header: prettyHeader(c), key: c, width: columnWidth(c) })),
  ];
  for (const r of pieces)
    ws.addRow(
      cols.reduce(
        (o, c) => {
          o[c] = cellValue(c, r[c]);
          return o;
        },
        {} as Record<string, unknown>,
      ),
    );
  styleSheet(ws, cols, 1);

  // Anchor a thumbnail into the first column of each row that has one.
  const ROW_PT = 68;
  pieces.forEach((p, i) => {
    const img = images.get(p.id);
    if (!img) return;
    const rowNumber = i + 2; // 1 is the header
    ws.getRow(rowNumber).height = ROW_PT;
    const id = wb.addImage({ buffer: img.data as unknown as ArrayBuffer, extension: "jpeg" });
    const scale = Math.min(88 / img.width, 84 / img.height, 1);
    ws.addImage(id, {
      tl: { col: 0.15, row: rowNumber - 1 + 0.1 },
      ext: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
    });
  });

  if (omitted > 0) {
    ws.addRow([]);
    ws.addRow([
      `Images shown for the first ${IMAGE_CAP} works; ${omitted} further works are listed without one.`,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();

  return exportResponse(
    request,
    new Uint8Array(buf as ArrayBuffer),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "inventory.xlsx",
    "Docs",
  );
}

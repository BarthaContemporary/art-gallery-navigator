import { exportResponse } from "@/lib/shared-drive";
import { factSheetDocx } from "@jvb/documents";
import { GALLERY_NAME, loadPieceDoc } from "@/lib/document-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per-work fact sheet as DOCX (editable in Proton Docs). ?stock=<stock_number> */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const stock = url.searchParams.get("stock");
  if (!stock) return new Response("Missing stock", { status: 400 });

  const { authed, piece } = await loadPieceDoc(stock);
  if (!authed) return new Response("Unauthorized", { status: 401 });
  if (!piece) return new Response("Not found", { status: 404 });

  const buf = await factSheetDocx({
    galleryName: GALLERY_NAME,
    works: [piece],
    showPrices: url.searchParams.get("prices") === "1",
  });

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    `fact-sheet-${stock}.docx`,
    "Docs",
  );
}

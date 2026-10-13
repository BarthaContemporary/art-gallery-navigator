import { exportResponse } from "@/lib/shared-drive";
import { renderToBuffer } from "@react-pdf/renderer";
import { Certificate } from "@jvb/documents";
import { GALLERY_NAME, loadPieceDoc } from "@/lib/document-data";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "12 October 2026", today in London: the server runs on UTC, which dated a
// certificate issued just after midnight in summer to the day before.
const today = () => formatDate(new Date(), "long");

/** Certificate of authenticity as PDF. ?stock=<stock_number> */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const stock = url.searchParams.get("stock");
  if (!stock) return new Response("Missing stock", { status: 400 });

  const { authed, piece } = await loadPieceDoc(stock);
  if (!authed) return new Response("Unauthorized", { status: 401 });
  if (!piece) return new Response("Not found", { status: 404 });

  const buf = await renderToBuffer(
    Certificate({ galleryName: GALLERY_NAME, work: piece, issuedDate: today() }),
  );

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/pdf",
    `certificate-${stock}.pdf`,
    "Certificates",
  );
}

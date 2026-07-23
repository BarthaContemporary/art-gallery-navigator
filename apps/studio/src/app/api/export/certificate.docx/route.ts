import { downloadWithDriveCopy } from "@/lib/shared-drive";
import { certificateDocx } from "@jvb/documents";
import { GALLERY_NAME, loadPieceDoc } from "@/lib/document-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const today = () =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

/** Certificate of authenticity as DOCX (editable in Proton Docs). ?stock=<stock_number> */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const stock = url.searchParams.get("stock");
  if (!stock) return new Response("Missing stock", { status: 400 });

  const { authed, piece } = await loadPieceDoc(stock);
  if (!authed) return new Response("Unauthorized", { status: 401 });
  if (!piece) return new Response("Not found", { status: 404 });

  const buf = await certificateDocx({
    galleryName: GALLERY_NAME,
    work: piece,
    issuedDate: today(),
  });

  return downloadWithDriveCopy(
    new Uint8Array(buf),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    `certificate-${stock}.docx`,
    "Certificates",
  );
}

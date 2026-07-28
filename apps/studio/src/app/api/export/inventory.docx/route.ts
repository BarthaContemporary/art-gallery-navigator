import { listDocx, type ListWork } from "@jvb/documents";
import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { GALLERY_NAME } from "@/lib/document-data";
import { fetchExportThumbnails, IMAGE_CAP } from "@/lib/export-images";
import { applyInventoryFilters } from "@/lib/inventory-query";

export const runtime = "nodejs";
// Embedding imagery makes this the slowest export in the app; give it room.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Inventory export as an editable DOCX checklist, with a thumbnail per work.
 * Honours the same filters as the CSV/XLSX exports so what you see in the
 * inventory is what you get in the file.
 */
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

  const pieces = (rows ?? []) as unknown as (ListWork & { id: string })[];
  const { images, omitted } = await fetchExportThumbnails(pieces.map((p) => p.id));

  const works: ListWork[] = pieces.map((p) => ({
    stock_number: p.stock_number,
    title: p.title,
    maker_name: p.maker_name,
    medium: p.medium,
    period: p.period,
    status: p.status,
    location_code: p.location_code,
    image: images.get(p.id) ?? null,
  }));

  const buf = await listDocx({
    galleryName: GALLERY_NAME,
    listName: "Inventory",
    subtitle:
      omitted > 0
        ? `${works.length} works · images shown for the first ${IMAGE_CAP}; ${omitted} further works are listed without one`
        : `${works.length} works`,
    works,
  });

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "inventory.docx",
    "Docs",
  );
}

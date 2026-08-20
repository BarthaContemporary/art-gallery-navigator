import { exportResponse } from "@/lib/shared-drive";
import { renderToBuffer } from "@react-pdf/renderer";
import { WorkLabels, type WorkLabel, type AveryTemplate } from "@jvb/documents";
import { getSupabase } from "@/lib/supabase";
import { resolveListPieceIds, type ListLike } from "@/lib/list-members";
import { loadPieceRows } from "@/lib/piece-store";
import { DIMENSION_COLUMNS, formatDimensionsFullCm, titleWithYear, type PieceDimensions } from "@jvb/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES: AveryTemplate[] = ["L7160", "L7162", "L7163"];

type Row = {
  id: string;
  stock_number: string;
  title: string | null;
  year: string | null;
  maker_name: string | null;
} & PieceDimensions;

/**
 * Object labels for the works in an inventory list, on Avery stock — the
 * companion to the contact mailing labels. The dimension line is the full
 * catalogue line: framed and unframed sizes together for framed works.
 */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const list = params.get("list");
  if (!list) return new Response("Missing list", { status: 400 });

  const templateParam = params.get("template");
  const template: AveryTemplate =
    templateParam && (TEMPLATES as string[]).includes(templateParam)
      ? (templateParam as AveryTemplate)
      : "L7163";

  const { data: listRow } = await supabase
    .from("piece_lists")
    .select("id, is_dynamic, filter_rules")
    .eq("id", list)
    .maybeSingle();
  if (!listRow) return new Response("List not found", { status: 404 });

  const ids = await resolveListPieceIds(supabase, listRow as ListLike);
  if (ids.length === 0)
    return new Response("This list has no works to label.", { status: 422 });

  const byId = await loadPieceRows<Row>(
    supabase,
    ids,
    `id, stock_number, title, year, maker_name, ${DIMENSION_COLUMNS}`,
  );
  // loadPieceRows returns a map; walk the list's own order.
  const works: WorkLabel[] = ids
    .map((id) => byId.get(id))
    .filter((r): r is Row => Boolean(r))
    .map((r) => ({
      stockNumber: r.stock_number,
      maker: r.maker_name ?? undefined,
      title: titleWithYear(r.title, r.year),
      dimensions: formatDimensionsFullCm(r) ?? undefined,
    }));

  const buf = await renderToBuffer(WorkLabels({ works, template }));

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/pdf",
    "work-labels.pdf",
    "Docs",
  );
}

import { listDocx, type ListWork } from "@jvb/documents";
import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { GALLERY_NAME } from "@/lib/document-data";
import { resolveListPieceIds } from "@/lib/list-members";
import { fetchExportThumbnails } from "@/lib/export-images";
import { selectInChunks } from "@/lib/chunk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Export one inventory list as an editable DOCX checklist (Proton Docs / Word). */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const listId = new URL(request.url).searchParams.get("list");
  if (!listId) return new Response("Missing list", { status: 400 });

  const { data: list } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, filter_rules")
    .eq("id", listId)
    .maybeSingle();
  if (!list) return new Response("List not found", { status: 404 });

  const ids = await resolveListPieceIds(supabase, list);

  let works: ListWork[] = [];
  if (ids.length > 0) {
    const data = await selectInChunks<ListWork & { id: string }>(ids, (chunk) =>
      supabase
        .from("vw_pieces_list")
        .select("id, stock_number, title, maker_name, medium, period, status, location_code")
        .in("id", chunk),
    );
    // .in() does not preserve the list's order; restore it.
    const byId = new Map(data.map((r) => [r.id, r]));
    const ordered = ids.map((pid) => byId.get(pid)).filter(Boolean) as (ListWork & { id: string })[];
    const { images } = await fetchExportThumbnails(ordered.map((p) => p.id));
    works = ordered.map((p) => ({ ...p, image: images.get(p.id) ?? null }));
  }

  const buf = await listDocx({
    galleryName: GALLERY_NAME,
    listName: String(list.name ?? "Inventory list"),
    subtitle: list.description ? String(list.description) : list.is_dynamic ? "Saved view — membership is live" : null,
    works,
  });

  const safe =
    String(list.name ?? "list")
      .replace(/[^\w\-. ]+/g, "")
      .trim()
      .slice(0, 60) || "list";

  return exportResponse(
    request,
    new Uint8Array(buf),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    `${safe}.docx`,
    "Docs",
  );
}

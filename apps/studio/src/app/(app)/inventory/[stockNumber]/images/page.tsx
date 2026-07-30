import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";
import { ImageUploader } from "@/components/image-uploader";
import { RotateImageButton } from "@/components/rotate-image-button";
import { ImageReorderGrid } from "@/components/image-reorder-grid";

export const metadata = { title: "Manage images" };

export default async function ManageImagesPage({
  params,
}: {
  params: Promise<{ stockNumber: string }>;
}) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();

  const ref = await resolvePiece(supabase, stockNumber);
  if (!ref) notFound();
  if (ref.retiredNumber) redirect(`/inventory/${encodeURIComponent(ref.stockNumber)}/images`);

  const { data: piece } = await supabase
    .from(ref.table)
    .select("id, stock_number, title")
    .eq("id", ref.id)
    .maybeSingle();
  if (!piece) notFound();
  // Plain value for the server actions below to close over.
  const pieceId: string = ref.id;

  const { data: images } = await supabase
    .from("piece_images")
    .select("id, role, caption, sort_order, storage_path_display, processing_status, processing_error, legacy_container_filename")
    .eq("piece_id", pieceId)
    // Match the reorder action's ordering exactly, so what you see is what a
    // move acts on even while sort_order still holds legacy nulls/duplicates.
    .order("sort_order", { nullsFirst: true })
    .order("created_at");

  const signed = await Promise.all(
    (images ?? []).map(async (img) => {
      let url: string | null = null;
      if (img.storage_path_display) {
        const { data } = await supabase.storage
          .from("piece-derivatives")
          .createSignedUrl(img.storage_path_display, 3600);
        url = data?.signedUrl ?? null;
      }
      return { ...img, url };
    }),
  );

  async function deleteImage(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const supabase = await getSupabase();
    await supabase.from("piece_images").delete().eq("id", id);
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}/images`);
  }

  /**
   * Persist a new image order.
   *
   * Renumbers the whole run rather than nudging individual sort_order values:
   * the FileMaker import left duplicates and nulls behind, so relative moves
   * between rows sharing a number do nothing visible. Rewriting the sequence
   * makes the order deterministic from the first drag onward. A piece holds a
   * handful of images, so the extra writes are irrelevant.
   *
   * Ids are checked against this piece before anything is written — the list
   * arrives from the browser, and a caller must not be able to renumber another
   * work's images by posting their ids.
   */
  async function reorderImages(ids: string[]) {
    "use server";
    const supabase = await getSupabase();

    const { data: current } = await supabase
      .from("piece_images")
      .select("id")
      .eq("piece_id", pieceId);
    const mine = new Set(((current ?? []) as { id: string }[]).map((r) => r.id));

    const ordered = ids.filter((id) => mine.has(id));
    // Anything the client omitted keeps its place at the end, so a stale tab
    // cannot silently drop an image out of the ordering.
    for (const id of mine) if (!ordered.includes(id)) ordered.push(id);

    await Promise.all(
      ordered.map((imgId, i) =>
        supabase.from("piece_images").update({ sort_order: i }).eq("id", imgId),
      ),
    );
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}/images`);
  }

  async function saveCaption(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const caption = String(formData.get("caption") ?? "");
    const supabase = await getSupabase();
    await supabase.from("piece_images").update({ caption: caption || null }).eq("id", id);
    revalidatePath(`/inventory/${encodeURIComponent(stockNumber)}/images`);
  }

  return (
    <div>
      <p className="text-[13px] text-ink-muted">
        <Link href={`/inventory/${encodeURIComponent(piece.stock_number)}`}>← Back to record</Link>
      </p>
      <h1 className="mt-2 text-[26px] font-semibold text-ink-strong">
        Images · <span className="font-mono text-[20px]">{piece.stock_number}</span>
      </h1>
      <div className="mt-5">
        <ImageUploader pieceId={piece.id} nextSortOrder={(images ?? []).length} />
      </div>
      {/*
        Tiles are rendered here, on the server, and handed to the grid keyed by
        id. The client component owns the order and nothing else, so the rotate,
        caption and delete controls below stay exactly as they were.
      */}
      {signed.length === 0 ? (
        <p className="mt-6 text-[13px] text-ink-muted">No images yet.</p>
      ) : (
        <ImageReorderGrid
          order={signed.map((img) => img.id)}
          onReorder={reorderImages}
          tiles={Object.fromEntries(
            signed.map((img) => [
              img.id,
              <div key={img.id} className="rounded-[9px] border border-line bg-cell p-2.5">
            <div className="jvb-hatch relative aspect-square overflow-hidden rounded-lg">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={img.caption ?? img.role} className="h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-ink-soft">
                  {img.processing_status === "pending" || img.processing_status === "processing"
                    ? "Processing…"
                    : img.processing_status === "error"
                      ? `Error: ${img.processing_error ?? "unknown"}`
                      : img.legacy_container_filename
                        ? `Awaiting legacy file ${img.legacy_container_filename}`
                        : "No preview"}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">{img.role}</p>
              {/* Rotate sits above the caption row, per request. Disabled until
                  there is a processed derivative to turn. Ordering is the grip
                  handle in the corner (ImageReorderGrid). */}
              <RotateImageButton imageId={img.id} disabled={!img.url} />
            </div>
            <form action={saveCaption} className="mt-1 flex gap-1.5">
              <input type="hidden" name="id" value={img.id} />
              <input
                name="caption"
                defaultValue={img.caption ?? ""}
                placeholder="Caption"
                className="w-full min-w-0 rounded-md border border-line-control bg-control px-2 py-1 text-[12px]"
              />
              <button type="submit" className="rounded-md border border-line-control bg-control px-2 py-1 text-[11px] font-medium text-ink-mid">
                Save
              </button>
            </form>
            <form action={deleteImage} className="mt-1.5">
              <input type="hidden" name="id" value={img.id} />
              <button type="submit" className="text-[11px] text-ink-soft underline">
                Delete
              </button>
            </form>
              </div>,
            ]),
          )}
        />
      )}
    </div>
  );
}

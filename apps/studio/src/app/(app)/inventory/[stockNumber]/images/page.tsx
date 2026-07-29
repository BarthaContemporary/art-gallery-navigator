import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { resolvePiece } from "@/lib/piece-store";
import { ImageUploader } from "@/components/image-uploader";
import { RotateImageButton } from "@/components/rotate-image-button";

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
   * Move one image earlier or later in the run.
   *
   * Renumbers every image in the piece rather than swapping two sort_order
   * values: the FileMaker import left duplicates and nulls behind, and a swap
   * between two rows that share a number does nothing visible. Rewriting the
   * whole sequence makes the order deterministic from the first move onward.
   * A piece holds a handful of images, so the extra writes are irrelevant.
   */
  async function moveImage(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const dir = String(formData.get("dir")) === "up" ? -1 : 1;
    const supabase = await getSupabase();

    const { data: current } = await supabase
      .from("piece_images")
      .select("id, sort_order, created_at")
      .eq("piece_id", pieceId)
      .order("sort_order", { nullsFirst: true })
      .order("created_at");
    const ordered = ((current ?? []) as { id: string }[]).map((r) => r.id);

    const from = ordered.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ordered.length) return;   // already at the end
    ordered.splice(to, 0, ...ordered.splice(from, 1));

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
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {signed.map((img, i) => (
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
              <span className="flex items-center gap-0.5">
                {/* Buttons rather than drag: this grid is used on an iPad at
                    fairs, and a drag target that small is a worse tool than a
                    tap. Also keyboard-reachable for nothing extra. */}
                <form action={moveImage}>
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Move image earlier"
                    title="Move earlier"
                    className="min-h-[28px] px-1.5 text-[13px] leading-none text-ink-soft hover:text-ink-strong disabled:opacity-30"
                  >
                    ‹
                  </button>
                </form>
                <form action={moveImage}>
                  <input type="hidden" name="id" value={img.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    type="submit"
                    disabled={i === signed.length - 1}
                    aria-label="Move image later"
                    title="Move later"
                    className="min-h-[28px] px-1.5 text-[13px] leading-none text-ink-soft hover:text-ink-strong disabled:opacity-30"
                  >
                    ›
                  </button>
                </form>
                {/* Rotate sits above the caption row, per request. Disabled until
                    there is a processed derivative to turn. */}
                <RotateImageButton imageId={img.id} disabled={!img.url} />
              </span>
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
          </div>
        ))}
        {signed.length === 0 ? (
          <p className="col-span-full text-[13px] text-ink-muted">No images yet.</p>
        ) : null}
      </div>
    </div>
  );
}

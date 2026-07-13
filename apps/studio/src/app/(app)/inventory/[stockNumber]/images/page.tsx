import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { ImageUploader } from "@/components/image-uploader";

export const metadata = { title: "Manage images" };

export default async function ManageImagesPage({
  params,
}: {
  params: Promise<{ stockNumber: string }>;
}) {
  const { stockNumber: raw } = await params;
  const stockNumber = decodeURIComponent(raw);
  const supabase = await getSupabase();

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, stock_number, title")
    .eq("stock_number", stockNumber)
    .maybeSingle();
  if (!piece) notFound();

  const { data: images } = await supabase
    .from("piece_images")
    .select("id, role, caption, sort_order, storage_path_display, processing_status, processing_error, legacy_container_filename")
    .eq("piece_id", piece.id)
    .order("sort_order");

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
        {signed.map((img) => (
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
            <p className="mt-2 text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">{img.role}</p>
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

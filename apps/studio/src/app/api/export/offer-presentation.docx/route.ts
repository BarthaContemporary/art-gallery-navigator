import { offerPresentationDocx, type PresentationWork } from "@jvb/documents";
import { getSupabase, getSession, createServiceClient } from "@/lib/supabase";
import { GALLERY_NAME, GALLERY_ADDRESS } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/**
 * Editable DOCX presentation of an offer: one work per page with its display
 * image embedded, title/maker/specs, and the offer price when the offer shows
 * prices. GET ?offer=<id>.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const offerId = new URL(request.url).searchParams.get("offer");
  if (!offerId) return new Response("Missing offer", { status: 400 });

  const supabase = await getSupabase();
  const { data: offer } = await supabase
    .from("offers")
    .select("id, title, intro, show_prices")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return new Response("Not found", { status: 404 });

  const { data: itemRows } = await supabase
    .from("offer_items")
    .select(
      "price_override_gbp, note, sort_order, piece:pieces ( id, stock_number, title, medium, period, origin_region, dimensions_display, description, maker:makers ( display_name, life_dates ) )",
    )
    .eq("offer_id", offerId)
    .order("sort_order");

  type Row = {
    price_override_gbp: number | null;
    note: string | null;
    piece: {
      id: string;
      stock_number: string;
      title: string | null;
      medium: string | null;
      period: string | null;
      origin_region: string | null;
      dimensions_display: string | null;
      description: string | null;
      maker: { display_name: string | null; life_dates: string | null } | null;
    } | null;
  };
  const items = ((itemRows ?? []) as unknown as Row[]).filter((r) => r.piece);
  if (items.length === 0) return new Response("Offer has no works", { status: 400 });

  // Marked prices (offer price fallback) — service client: this export is for
  // the dealer, and the offer explicitly shows prices when show_prices is set.
  const svc = createServiceClient();
  const pieceIds = items.map((r) => r.piece!.id);
  const priceByPiece = new Map<string, number>();
  if (offer.show_prices) {
    const { data: fins } = await svc
      .from("piece_financials")
      .select("piece_id, marked_price_gbp")
      .in("piece_id", pieceIds);
    for (const f of (fins ?? []) as { piece_id: string; marked_price_gbp: number | null }[]) {
      if (f.marked_price_gbp != null) priceByPiece.set(f.piece_id, f.marked_price_gbp);
    }
  }

  // Primary display image per piece (lowest role/sort with a display master).
  const { data: imgs } = await svc
    .from("piece_images")
    .select("piece_id, storage_path_display, width, height, sort_order")
    .in("piece_id", pieceIds)
    .not("storage_path_display", "is", null)
    .order("sort_order");
  const imgByPiece = new Map<string, { path: string; width: number; height: number }>();
  for (const im of (imgs ?? []) as {
    piece_id: string;
    storage_path_display: string;
    width: number | null;
    height: number | null;
  }[]) {
    if (!imgByPiece.has(im.piece_id))
      imgByPiece.set(im.piece_id, {
        path: im.storage_path_display,
        width: im.width ?? 1600,
        height: im.height ?? 1600,
      });
  }

  const works: PresentationWork[] = [];
  for (const r of items) {
    const p = r.piece!;
    let image: PresentationWork["image"] = null;
    const im = imgByPiece.get(p.id);
    if (im) {
      const { data: signed } = await svc.storage
        .from("piece-derivatives")
        .createSignedUrl(im.path, 300);
      if (signed?.signedUrl) {
        try {
          const res = await fetch(signed.signedUrl);
          if (res.ok) {
            image = {
              data: Buffer.from(await res.arrayBuffer()),
              type: "jpg",
              width: im.width,
              height: im.height,
            };
          }
        } catch {
          /* no image — page renders without */
        }
      }
    }
    const price =
      offer.show_prices
        ? r.price_override_gbp ?? priceByPiece.get(p.id) ?? null
        : null;
    works.push({
      stockNumber: p.stock_number,
      title: p.title ?? "Untitled",
      maker: p.maker?.display_name ?? null,
      makerLifeDates: p.maker?.life_dates ?? null,
      period: p.period,
      originRegion: p.origin_region,
      medium: p.medium,
      dimensionsDisplay: p.dimensions_display,
      description: p.description,
      priceDisplay: price != null ? gbp(price) : null,
      note: r.note,
      image,
    });
  }

  const buf = await offerPresentationDocx({
    galleryName: GALLERY_NAME,
    galleryAddress: GALLERY_ADDRESS,
    title: offer.title ?? "Selected works",
    intro: offer.intro,
    works,
  });

  const filename = `${(offer.title ?? "presentation").replace(/[^\w\- ]+/g, "").trim() || "presentation"}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

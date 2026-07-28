import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServiceClient } from "@jvb/db/server";
import { OfferResponse } from "@/components/offer-response";
import { OfferGate } from "@/components/offer-gate";
import { grantCookieName, verifyGrant } from "@/lib/offer-access";

/** Tokenized private offer / fair-preview page. Never indexed, never cached. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private viewing",
  robots: { index: false, follow: false, nocache: true },
};

/* ---------------------------------------------------------------- */
/* Row shapes (service-role client is untyped; narrowed via cast)    */
/* ---------------------------------------------------------------- */

interface ImageRow {
  id: string;
  role: string | null;
  caption: string | null;
  sort_order: number | null;
  storage_path_display: string | null;
  processing_status: string | null;
}

interface PieceRow {
  id: string;
  stock_number: string | null;
  title: string | null;
  medium: string | null;
  period: string | null;
  origin_region: string | null;
  dimensions_display: string | null;
  financials: { marked_price_gbp: number | null } | { marked_price_gbp: number | null }[] | null;
  images: ImageRow[] | null;
}

interface ItemRow {
  id: string;
  price_override_gbp: number | null;
  note: string | null;
  piece_id: string;
  /** Filled in by a second pass — see the loader below. */
  piece: PieceRow | null;
}

interface OfferRow {
  id: string;
  title: string | null;
  kind: string | null;
  intro: string | null;
  show_prices: boolean | null;
  expires_at: string | null;
  access_password: string | null;
  items: ItemRow[] | null;
}

interface RecipientRow {
  id: string;
  token: string;
  response: "interested" | "declined" | null;
  view_count: number | null;
  first_viewed_at: string | null;
  contact: {
    first_name: string | null;
    last_name: string | null;
    salutation: string | null;
  } | null;
  offer: OfferRow | null;
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function markedPrice(piece: PieceRow): number | null {
  const fin = piece.financials;
  if (!fin) return null;
  const row = Array.isArray(fin) ? (fin[0] ?? null) : fin;
  return row?.marked_price_gbp ?? null;
}

/** Primary display image: prefer role "front", then lowest sort_order. */
function primaryImage(piece: PieceRow): ImageRow | null {
  const usable = (piece.images ?? [])
    .filter((img) => img.storage_path_display && img.processing_status !== "error")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return usable.find((img) => img.role === "front") ?? usable[0] ?? null;
}

function UnavailableView() {
  return (
    <div className="page flex flex-col items-start py-[var(--section)]">
      <h1 className="max-w-[var(--measure)] font-sans text-h1 font-medium tracking-tight text-sumi">
        This private link is no longer available
      </h1>
      <p className="mt-5 max-w-[var(--measure)] font-serif text-body text-ink-70">
        The selection you were sent has expired or the link is not recognised. We
        would be delighted to show you what is currently available — please get in
        touch and we will send a fresh selection.
      </p>
      <Link href="/contact" className="btn btn-filled mt-10">
        Contact the gallery
      </Link>
    </div>
  );
}

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 8) return <UnavailableView />;

  let recipient: RecipientRow | null = null;
  let supabase: ReturnType<typeof createServiceClient> | null = null;

  try {
    supabase = createServiceClient();
    const { data } = await supabase
      .from("offer_recipients")
      .select(
        `id, token, response, view_count, first_viewed_at,
         contact:crm_contacts ( first_name, last_name, salutation ),
         offer:offers (
           id, title, kind, intro, show_prices, expires_at, access_password,
           items:offer_items ( id, price_override_gbp, note, piece_id )
         )`,
      )
      .eq("token", token)
      .maybeSingle();
    recipient = (data as unknown as RecipientRow) ?? null;

    // Offer lines key on the shared work identity rather than on a single
    // stock table, so the works, their prices and their images are loaded in a
    // second pass and stitched back onto the lines.
    const lines: ItemRow[] = recipient?.offer?.items ?? [];
    const pieceIds = lines.map((i) => i.piece_id).filter(Boolean);
    if (pieceIds.length > 0) {
      const [{ data: works }, { data: fins }, { data: imgs }] = await Promise.all([
        supabase
          .from("vw_pieces_all")
          .select("id, stock_number, title, medium, period, origin_region, dimensions_display")
          .in("id", pieceIds),
        supabase.from("piece_financials").select("piece_id, marked_price_gbp").in("piece_id", pieceIds),
        supabase
          .from("piece_images")
          .select("id, piece_id, role, caption, sort_order, storage_path_display, processing_status")
          .in("piece_id", pieceIds),
      ]);
      const byId = new Map((works ?? []).map((w) => [w.id as string, w]));
      const finByPiece = new Map((fins ?? []).map((f) => [f.piece_id as string, f]));
      const imagesByPiece = new Map<string, ImageRow[]>();
      for (const img of (imgs ?? []) as (ImageRow & { piece_id: string })[]) {
        const list = imagesByPiece.get(img.piece_id) ?? [];
        list.push(img);
        imagesByPiece.set(img.piece_id, list);
      }
      for (const line of lines) {
        const work = byId.get(line.piece_id);
        line.piece = work
          ? ({
              ...work,
              financials: finByPiece.get(line.piece_id) ?? null,
              images: imagesByPiece.get(line.piece_id) ?? [],
            } as unknown as PieceRow)
          : null;
      }
    }
  } catch {
    recipient = null;
  }

  const offer = recipient?.offer ?? null;
  const expired =
    !recipient ||
    !offer ||
    (offer.expires_at !== null && new Date(offer.expires_at).getTime() < Date.now());

  if (expired || !recipient || !offer || !supabase) {
    return <UnavailableView />;
  }

  // Password gate: if the offer carries an access password, require a valid
  // access cookie (set after unlocking or via a magic link) before revealing
  // the works — and don't log a view for a locked page.
  if (offer.access_password) {
    const cookieVal = (await cookies()).get(grantCookieName(token))?.value;
    if (!verifyGrant(token, cookieVal, Date.now())) {
      return <OfferGate token={token} />;
    }
  }

  // Log the view (best-effort — never blocks rendering).
  const nowIso = new Date().toISOString();
  try {
    await supabase.from("offer_views").insert({
      recipient_id: recipient.id,
      viewed_at: nowIso,
    });
    await supabase
      .from("offer_recipients")
      .update({
        view_count: (recipient.view_count ?? 0) + 1,
        first_viewed_at: recipient.first_viewed_at ?? nowIso,
        last_viewed_at: nowIso,
      })
      .eq("id", recipient.id);
  } catch {
    // view logging must never break the page
  }

  // Signed URLs for the primary image of each piece (private bucket, 1h expiry).
  const items = (offer.items ?? []).filter((item) => item.piece);
  const heroByPiece = new Map<string, ImageRow>();
  for (const item of items) {
    const hero = item.piece ? primaryImage(item.piece) : null;
    if (item.piece && hero) heroByPiece.set(item.piece.id, hero);
  }
  const paths = [...heroByPiece.values()]
    .map((img) => img.storage_path_display)
    .filter((p): p is string => Boolean(p));

  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data: signed } = await supabase.storage
        .from("piece-derivatives")
        .createSignedUrls(paths, 60 * 60);
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl && !entry.error) {
          signedByPath.set(entry.path, entry.signedUrl);
        }
      }
    } catch {
      // render without images rather than failing
    }
  }

  const firstName =
    recipient.contact?.first_name ?? recipient.contact?.salutation ?? null;
  const expiryDate = offer.expires_at
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(offer.expires_at),
      )
    : null;

  return (
    <div className="page py-16">
      <header className="max-w-[var(--measure)]">
        <p className="label">
          {offer.kind === "fair_preview"
            ? "Fair preview"
            : offer.kind === "viewing_room"
              ? "Private viewing room"
              : "Private offer"}
        </p>
        <h1 className="mt-3 font-sans text-h1 font-medium tracking-tight text-sumi">
          {offer.title ?? "A selection of works"}
        </h1>
        <p className="mt-5 font-serif text-body text-ink-70">
          {firstName ? `Dear ${firstName}, ` : ""}
          {offer.intro ??
            "we have set aside the following works, which we thought would be of particular interest to you."}
        </p>
        {expiryDate ? (
          <p className="mt-3 font-serif text-ui text-ink-50">
            This selection is reserved for you until {expiryDate}.
          </p>
        ) : null}
      </header>

      <ul className="mt-[var(--section)] grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const piece = item.piece!;
          const hero = heroByPiece.get(piece.id) ?? null;
          const src = hero?.storage_path_display
            ? (signedByPath.get(hero.storage_path_display) ?? null)
            : null;
          const price = offer.show_prices
            ? (item.price_override_gbp ?? markedPrice(piece))
            : null;

          return (
            <li key={item.id}>
              <figure>
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-washi-2">
                  {src ? (
                    /* Signed URLs expire hourly — served directly, not through
                       the image optimizer cache. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={
                        hero?.caption ??
                        ([piece.title, piece.period].filter(Boolean).join(", ") || "Artwork")
                      }
                      className="h-full w-full object-contain p-6"
                      loading="lazy"
                    />
                  ) : (
                    <span className="label text-ink-50">Photography to follow</span>
                  )}
                </div>
                <figcaption className="mt-4 space-y-1">
                  <p className="font-sans text-ui font-medium text-sumi">
                    {piece.title ?? "Untitled"}
                  </p>
                  <p className="font-serif text-ui text-ink-70">
                    {[piece.period, piece.origin_region, piece.medium]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {piece.dimensions_display ? (
                    <p className="font-serif text-ui text-ink-50">
                      {piece.dimensions_display}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="font-serif text-ui text-ink-70">{item.note}</p>
                  ) : null}
                  <p className="flex items-baseline justify-between gap-2 pt-1">
                    <span className="label">{piece.stock_number}</span>
                    <span className="font-serif text-ui text-ink-70">
                      {offer.show_prices ? (price !== null ? gbp.format(price) : "POA") : ""}
                    </span>
                  </p>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>

      <section className="mt-[var(--section)] max-w-[var(--measure)] pt-10">
        <h2 className="font-sans text-h2 font-medium tracking-tight text-sumi">
          Would you like to know more?
        </h2>
        <p className="mt-3 font-serif text-body text-ink-70">
          Let us know and we will follow up personally with prices, further
          photography and condition notes — or simply reply to our email.
        </p>
        <div className="mt-8">
          <OfferResponse token={token} initialResponse={recipient.response} />
        </div>
      </section>
    </div>
  );
}

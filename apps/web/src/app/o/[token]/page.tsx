import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@jvb/db/server";
import { OfferResponse } from "@/components/offer-response";

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
  price_override: number | null;
  note: string | null;
  piece: PieceRow | null;
}

interface OfferRow {
  id: string;
  title: string | null;
  kind: string | null;
  intro: string | null;
  show_prices: boolean | null;
  expires_at: string | null;
  status: string | null;
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
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
        This private link is no longer available
      </h1>
      <p className="mt-4 leading-relaxed text-ink-muted">
        The selection you were sent has expired or the link is not recognised. We would be
        delighted to show you what is currently available — please get in touch and we will send a
        fresh selection.
      </p>
      <Link
        href="/contact"
        className="mt-8 inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
      >
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
           id, title, kind, intro, show_prices, expires_at, status,
           items:offer_items (
             id, price_override, note,
             piece:pieces (
               id, stock_number, title, medium, period, origin_region, dimensions_display,
               financials:piece_financials ( marked_price_gbp ),
               images:piece_images ( id, role, caption, sort_order, storage_path_display, processing_status )
             )
           )
         )`,
      )
      .eq("token", token)
      .maybeSingle();
    recipient = (data as unknown as RecipientRow) ?? null;
  } catch {
    recipient = null;
  }

  const offer = recipient?.offer ?? null;
  const expired =
    !recipient ||
    !offer ||
    offer.status === "archived" ||
    (offer.expires_at !== null && new Date(offer.expires_at).getTime() < Date.now());

  if (expired || !recipient || !offer || !supabase) {
    return <UnavailableView />;
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          {offer.kind === "fair_preview"
            ? "Fair preview"
            : offer.kind === "viewing_room"
              ? "Private viewing room"
              : "Private offer"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-strong">
          {offer.title ?? "A selection of works"}
        </h1>
        <p className="mt-5 leading-relaxed text-ink-body">
          {firstName ? `Dear ${firstName}, ` : ""}
          {offer.intro ??
            "we have set aside the following works, which we thought would be of particular interest to you."}
        </p>
        {expiryDate ? (
          <p className="mt-3 text-sm text-ink-muted">
            This selection is reserved for you until {expiryDate}.
          </p>
        ) : null}
      </header>

      <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const piece = item.piece!;
          const hero = heroByPiece.get(piece.id) ?? null;
          const src = hero?.storage_path_display
            ? (signedByPath.get(hero.storage_path_display) ?? null)
            : null;
          const price = offer.show_prices
            ? (item.price_override ?? markedPrice(piece))
            : null;

          return (
            <li key={item.id}>
              <figure>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-grid bg-placeholder">
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
                      className="h-full w-full object-contain p-3"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-ink-faint">Photography to follow</span>
                  )}
                </div>
                <figcaption className="mt-3">
                  <p className="font-medium text-ink-strong">{piece.title ?? "Untitled"}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {[piece.period, piece.origin_region, piece.medium]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {piece.dimensions_display ? (
                    <p className="mt-0.5 text-xs text-ink-soft">{piece.dimensions_display}</p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1.5 text-sm italic text-ink-muted">{item.note}</p>
                  ) : null}
                  <p className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-soft">
                      {piece.stock_number}
                    </span>
                    <span className="text-sm text-ink-body">
                      {offer.show_prices ? (price !== null ? gbp.format(price) : "POA") : ""}
                    </span>
                  </p>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>

      <section className="mt-16 max-w-xl border-t border-line-soft pt-10">
        <h2 className="text-lg font-semibold text-ink-heading">Would you like to know more?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Let us know and we will follow up personally with prices, further photography and
          condition notes — or simply reply to our email.
        </p>
        <div className="mt-6">
          <OfferResponse token={token} initialResponse={recipient.response} />
        </div>
      </section>
    </div>
  );
}

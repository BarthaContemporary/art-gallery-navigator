import { getSupabase } from "@/lib/supabase";

export interface PieceDoc {
  stockNumber: string;
  title: string;
  maker?: string;
  makerLifeDates?: string;
  period?: string;
  originRegion?: string;
  medium?: string;
  dimensionsDisplay?: string;
  signatureInscription?: string;
  description?: string;
  provenance: { dateText?: string; text: string }[];
  imageUrl?: string;
}

type PieceRow = {
  id: string;
  stock_number: string;
  title: string | null;
  medium: string | null;
  period: string | null;
  origin_region: string | null;
  description: string | null;
  signature_inscription: string | null;
  dimensions_display: string | null;
  maker: { display_name: string | null; life_dates: string | null } | null;
};

/**
 * Assemble the data a fact sheet / certificate needs for one piece, including
 * a signed URL for its primary image. Returns `null` piece if not found;
 * `authed:false` if the caller has no session.
 */
export async function loadPieceDoc(
  stock: string,
): Promise<{ authed: boolean; piece: PieceDoc | null }> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authed: false, piece: null };

  const { data } = await supabase
    .from("pieces")
    .select(
      "id, stock_number, title, medium, period, origin_region, description, signature_inscription, dimensions_display, maker:makers ( display_name, life_dates )",
    )
    .eq("stock_number", stock)
    .maybeSingle();
  const row = data as unknown as PieceRow | null;
  if (!row) return { authed: true, piece: null };

  const { data: prov } = await supabase
    .from("provenance_entries")
    .select("date_text, party, details, is_public, sort_order")
    .eq("piece_id", row.id)
    .eq("is_public", true)
    .order("sort_order", { nullsFirst: true });

  const provenance = (prov ?? [])
    .map((p) => ({
      dateText: p.date_text ?? undefined,
      text: [p.party, p.details].filter(Boolean).join(" — "),
    }))
    .filter((p) => p.text);

  // Primary image → signed URL (prefer the 'front' shot, then sort order).
  let imageUrl: string | undefined;
  const { data: imgs } = await supabase
    .from("piece_images")
    .select("role, sort_order, storage_path_display, processing_status")
    .eq("piece_id", row.id)
    .not("storage_path_display", "is", null);
  const usable = (imgs ?? [])
    .filter((i) => i.storage_path_display && i.processing_status !== "error")
    .sort(
      (a, b) =>
        (a.role === "front" ? 0 : 1) - (b.role === "front" ? 0 : 1) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  const path = usable[0]?.storage_path_display as string | undefined;
  if (path) {
    const { data: signed } = await supabase.storage
      .from("piece-derivatives")
      .createSignedUrl(path, 60 * 10);
    imageUrl = signed?.signedUrl ?? undefined;
  }

  return {
    authed: true,
    piece: {
      stockNumber: row.stock_number,
      title: row.title ?? "Untitled",
      maker: row.maker?.display_name ?? undefined,
      makerLifeDates: row.maker?.life_dates ?? undefined,
      period: row.period ?? undefined,
      originRegion: row.origin_region ?? undefined,
      medium: row.medium ?? undefined,
      dimensionsDisplay: row.dimensions_display ?? undefined,
      signatureInscription: row.signature_inscription ?? undefined,
      description: row.description ?? undefined,
      provenance,
      imageUrl,
    },
  };
}

export const GALLERY_NAME = "Joost van den Bergh";

import { selectInChunks } from "@/lib/chunk";

type Db = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        not: (
          column: string,
          op: string,
          value: null,
        ) => PromiseLike<{ data: ImageRow[] | null; error: { message: string } | null }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (
        paths: string[],
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string | null }[] | null }>;
    };
  };
};

type ImageRow = {
  piece_id: string;
  role: string | null;
  sort_order: number | null;
  created_at: string;
  storage_path_display: string | null;
};

/**
 * Lower sorts first. Matches vw_pieces_list's primary_image_id — the front
 * shot if there is one, then sort order, then age — so a work shows the same
 * thumbnail wherever it appears.
 */
function rank(a: ImageRow): [number, number, string] {
  return [a.role === "front" ? 0 : 1, a.sort_order ?? 0, a.created_at];
}

function isBetter(a: ImageRow, b: ImageRow): boolean {
  const [ar, as_, ac] = rank(a);
  const [br, bs, bc] = rank(b);
  if (ar !== br) return ar < br;
  if (as_ !== bs) return as_ < bs;
  return ac < bc;
}

/**
 * Signed thumbnail URLs for a set of works, keyed by piece id.
 *
 * One query for the images and one batch signing call, however many works are
 * passed — a signed URL per row would be a request per row. Works without a
 * processed derivative are simply absent from the map, so callers render their
 * own placeholder.
 */
export async function loadThumbnails(
  supabase: unknown,
  pieceIds: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const db = supabase as Db;
  const out = new Map<string, string>();
  const ids = [...new Set(pieceIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const rows = await selectInChunks<ImageRow>(ids, (chunk) =>
    db
      .from("piece_images")
      .select("piece_id, role, sort_order, created_at, storage_path_display")
      .in("piece_id", chunk)
      .not("storage_path_display", "is", null),
  );

  const best = new Map<string, ImageRow>();
  for (const row of rows) {
    if (!row.storage_path_display) continue;
    const current = best.get(row.piece_id);
    if (!current || isBetter(row, current)) best.set(row.piece_id, row);
  }
  if (best.size === 0) return out;

  const entries = [...best.entries()];
  const { data: signed } = await db.storage
    .from("piece-derivatives")
    .createSignedUrls(
      entries.map(([, img]) => img.storage_path_display as string),
      expiresIn,
    );
  (signed ?? []).forEach((s, i) => {
    const pieceId = entries[i]?.[0];
    if (pieceId && s.signedUrl) out.set(pieceId, s.signedUrl);
  });
  return out;
}

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
      createSignedUrl: (
        path: string,
        expiresIn: number,
        options?: { transform?: { width?: number; height?: number; quality?: number } },
      ) => Promise<{ data: { signedUrl: string } | null }>;
    };
  };
};

/**
 * Thumbnails come from the storage transform, not the display master: masters
 * run to 4096 px, and a list of fifty would otherwise pull a hundred
 * megabytes. Width in pixels; the server keeps the proportions.
 */
export const THUMB_WIDTH = 320;
export const PREVIEW_WIDTH = 1000;

/*
 * Signed URLs are reused while the function instance stays warm. Signing is a
 * storage request per image (a hundred on the inventory page), its CPU is the
 * largest cost left on the list pages, and a URL that changed on every view
 * kept the browser from caching a single thumbnail.
 *
 * A URL is only handed back to the user it was signed for: the cache key
 * starts with the signer's user id, read once per client from its session
 * cookie. A client with no session (the service client) signs as before and
 * caches nothing. Cached URLs are signed for SIGN_SECONDS and handed out for
 * REUSE_MS, so every URL a page receives has at least an hour left.
 *
 * Rotating or reprocessing a photo rewrites the file under the same path, so
 * a cached URL is only reused for the same version of the image (its size,
 * byte count and rotation; see imageVersion). Callers that pass no version
 * get a fresh URL every time, as before.
 */
const SIGN_SECONDS = 6 * 3600;
const REUSE_MS = 5 * 3600 * 1000;
const MAX_ENTRIES = 5000;
const signed = new Map<string, { url: string; until: number }>();
const signerIds = new WeakMap<object, Promise<string | null>>();

type SessionReader = { auth?: { getSession: () => Promise<{ data: { session: { access_token?: string } | null } }> } };

/** The signed-in user's id from the client's session cookie, once per client. */
function signerId(db: object): Promise<string | null> {
  let id = signerIds.get(db);
  if (!id) {
    const auth = (db as SessionReader).auth;
    id = auth
      ? auth
          .getSession()
          .then(({ data }) => {
            const payload = data.session?.access_token?.split(".")[1];
            if (!payload) return null;
            const sub = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown }).sub;
            return typeof sub === "string" ? sub : null;
          })
          .catch(() => null)
      : Promise.resolve(null);
    signerIds.set(db, id);
  }
  return id;
}

/** The image columns that change whenever the file under its path changes. */
export const IMAGE_VERSION_COLUMNS = "width, height, file_size_bytes, rotation";

type VersionedImage = {
  width?: number | null;
  height?: number | null;
  file_size_bytes?: number | null;
  rotation?: number | null;
};

/** Changes when the worker reprocesses the image or someone rotates it. */
export function imageVersion(img: VersionedImage): string {
  return `${img.width ?? ""}x${img.height ?? ""}:${img.file_size_bytes ?? ""}:${img.rotation ?? 0}`;
}

/**
 * A signed URL for a storage path rendered at `width` px wide. With a
 * `version` (imageVersion) the URL is reused for the same user and version.
 */
export async function signedThumbnail(
  db: Pick<Db, "storage">,
  bucket: string,
  path: string,
  width: number,
  expiresIn = 3600,
  version?: string | null,
): Promise<string | null> {
  const transform = { transform: { width, quality: 75 } };
  const userId = version ? await signerId(db) : null;
  if (!userId) {
    const { data } = await db.storage.from(bucket).createSignedUrl(path, expiresIn, transform);
    return data?.signedUrl ?? null;
  }

  const key = `${userId}|${bucket}|${path}|${width}|${version}`;
  const now = Date.now();
  const hit = signed.get(key);
  if (hit && hit.until > now) return hit.url;

  const { data } = await db.storage.from(bucket).createSignedUrl(path, Math.max(expiresIn, SIGN_SECONDS), transform);
  const url = data?.signedUrl ?? null;
  if (url) {
    if (signed.size >= MAX_ENTRIES) {
      // Oldest first: a Map keeps insertion order.
      for (const k of signed.keys()) {
        signed.delete(k);
        if (signed.size < MAX_ENTRIES * 0.9) break;
      }
    }
    signed.delete(key);
    signed.set(key, { url, until: now + REUSE_MS });
  }
  return url;
}

type ImageRow = VersionedImage & {
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
      .select(`piece_id, role, sort_order, created_at, storage_path_display, ${IMAGE_VERSION_COLUMNS}`)
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
  const signed = await Promise.all(
    entries.map(([, img]) =>
      signedThumbnail(db, "piece-derivatives", img.storage_path_display as string, THUMB_WIDTH, expiresIn, imageVersion(img)),
    ),
  );
  signed.forEach((url, i) => {
    const pieceId = entries[i]?.[0];
    if (pieceId && url) out.set(pieceId, url);
  });
  return out;
}

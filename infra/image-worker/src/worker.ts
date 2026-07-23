/**
 * @jvb/image-worker — derivative pipeline (BUILD_PLAN §4).
 *
 * Flow:
 *   - The studio uploads originals (resumable TUS) into the private bucket
 *     `piece-originals` and inserts a piece_images row with
 *     processing_status = 'pending'. A DB trigger fires
 *     `pg_notify('new_piece_image', <image id>)` (created in supabase/migrations).
 *   - This worker LISTENs on that channel and additionally polls every
 *     POLL_INTERVAL_MS (default 60s) as the reliable fallback.
 *   - Each cycle claims up to BATCH_SIZE pending rows (FOR UPDATE SKIP LOCKED,
 *     so multiple workers would not double-process), then per image:
 *       download original → EXIF subset via exifr → sharp: auto-rotate,
 *       sRGB, max 2560px longest side (no enlargement), JPEG q85 →
 *       upload to `piece-derivatives/${piece_id}/${image_id}.jpg` →
 *       update the row (paths, dims, bytes, exif, status 'done').
 *   - Any failure marks the row 'error' with the message so the studio can
 *     surface it and offer a retry (retry = set status back to 'pending').
 */

import { createClient } from "@supabase/supabase-js";
import exifr from "exifr";
import convert from "heic-convert";
import pg from "pg";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail fast: docker restart policy will surface a config problem loudly.
    console.error(`[${new Date().toISOString()}] FATAL missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = requireEnv("DATABASE_URL");

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 5);

const ORIGINALS_BUCKET = "piece-originals";
const DERIVATIVES_BUCKET = "piece-derivatives";
const NOTIFY_CHANNEL = "new_piece_image";

/** Display master: longest side, never enlarged (BUILD_PLAN §4). */
const MAX_DIMENSION_PX = 2560;
// Decompression-bomb ceiling: cap decoded pixels so a small, highly compressed
// original can't force a multi-GB raw allocation and OOM the worker. 100 MP is
// far above any real gallery photo yet well under a bomb (matches the
// imgproxy IMGPROXY_MAX_SRC_RESOLUTION guard).
const MAX_INPUT_PIXELS = 100_000_000;
const JPEG_QUALITY = 85;

// ---------------------------------------------------------------------------
// Logging — timestamped, structured-ish, one line per event
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const suffix = extra && Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingImage {
  id: string;
  piece_id: string;
  storage_path_original: string | null;
}

/** Subset of EXIF we persist on piece_images.exif (jsonb). */
interface ExifSubset {
  camera: string | null;
  lens: string | null;
  datetime: string | null;
  orientation: number | null;
}

// ---------------------------------------------------------------------------
// Phase 2b stub
// ---------------------------------------------------------------------------

/**
 * TODO(Phase 2b): CLIP image embeddings.
 *
 * In Phase 2b this will run an open-source CLIP model over the display
 * master and write a 512-dim vector into piece_embeddings.image_embedding
 * (see BUILD_PLAN §4b — powers "similar works" and new-entry prefill).
 * Deliberately a stub for now so the pipeline shape (and the call site
 * below) is already in place. Returns null = "no embedding produced".
 */
async function generateImageEmbedding(_displayJpeg: Buffer): Promise<number[] | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

/**
 * Atomically claim up to BATCH_SIZE pending rows by flipping them to
 * 'processing'. SKIP LOCKED makes this safe under concurrent workers.
 */
async function claimBatch(): Promise<PendingImage[]> {
  const result = await pool.query<PendingImage>(
    `UPDATE piece_images
        SET processing_status = 'processing'
      WHERE id IN (
              SELECT id
                FROM piece_images
               WHERE processing_status = 'pending'
               ORDER BY id
               LIMIT $1
                 FOR UPDATE SKIP LOCKED
            )
  RETURNING id, piece_id, storage_path_original`,
    [BATCH_SIZE],
  );
  return result.rows;
}

/** Extract the EXIF subset we keep; EXIF failures never fail the pipeline. */
async function extractExif(original: Buffer): Promise<ExifSubset> {
  try {
    const raw: Record<string, unknown> | undefined = await exifr.parse(original, {
      pick: ["Make", "Model", "LensModel", "DateTimeOriginal", "Orientation"],
    });
    const make = typeof raw?.Make === "string" ? raw.Make.trim() : "";
    const model = typeof raw?.Model === "string" ? raw.Model.trim() : "";
    const dt = raw?.DateTimeOriginal;
    return {
      camera: [make, model].filter(Boolean).join(" ") || null,
      lens: typeof raw?.LensModel === "string" ? raw.LensModel : null,
      datetime: dt instanceof Date ? dt.toISOString() : typeof dt === "string" ? dt : null,
      orientation: typeof raw?.Orientation === "number" ? raw.Orientation : null,
    };
  } catch (err) {
    log("warn", "exif extraction failed (continuing without)", { error: errorMessage(err) });
    return { camera: null, lens: null, datetime: null, orientation: null };
  }
}

async function downloadOriginal(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ORIGINALS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`download from ${ORIGINALS_BUCKET}/${path} failed: ${error?.message ?? "no data"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

async function markError(imageId: string, err: unknown): Promise<void> {
  const message = errorMessage(err).slice(0, 2000);
  try {
    await pool.query(
      `UPDATE piece_images
          SET processing_status = 'error',
              processing_error  = $2
        WHERE id = $1`,
      [imageId, message],
    );
  } catch (updateErr) {
    log("error", "failed to record error state", { imageId, error: errorMessage(updateErr) });
  }
}

/** True when sharp/libvips couldn't decode the input because it's HEIC/HEVC. */
function isHeifDecodeError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /compression format has not been built in|heif|no.*decoding plugin/i.test(m);
}

/**
 * HEIF/HEIC sniff by container signature (ISO-BMFF ftyp brand). libvips'
 * error message varies by build ("compression format has not been built in"
 * vs "bad seek"), so the buffer itself is the reliable signal for whether the
 * heic-convert fallback applies.
 */
function looksLikeHeif(buf: Buffer): boolean {
  if (buf.length < 12 || buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand);
}

async function processImage(row: PendingImage): Promise<void> {
  const startedAt = Date.now();
  log("info", "processing image", { imageId: row.id, pieceId: row.piece_id, original: row.storage_path_original });

  // Legacy stubs from the FileMaker migration can exist without a matched
  // original file — nothing to process, record that cleanly.
  if (!row.storage_path_original) {
    await markError(row.id, new Error("No original image file (legacy stub not matched to a file)"));
    return;
  }

  const original = await downloadOriginal(row.storage_path_original);
  const exif = await extractExif(original);

  // sharp: .rotate() with no args auto-orients from EXIF; TIFF input is
  // handled natively by libvips; toColorspace('srgb') normalises AdobeRGB /
  // ProPhoto / CMYK originals to an sRGB display master.
  const toMaster = (buf: Buffer) =>
    sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .toColorspace("srgb")
      .resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

  let displayJpeg: Buffer;
  let info: sharp.OutputInfo;
  try {
    ({ data: displayJpeg, info } = await toMaster(original));
  } catch (err) {
    // sharp's bundled libvips can't decode HEIC/HEVC (patent licensing), so
    // iPhone HEIC photos fail with "compression format has not been built in".
    // Fall back to a pure-JS decoder (libheif-js/WASM), then run the normal
    // pipeline on the JPEG it produces. AVIF and everything else still go
    // straight through sharp.
    if (isHeifDecodeError(err) || looksLikeHeif(original)) {
      log("info", "HEIC original — decoding via heic-convert", { imageId: row.id });
      // Pixel-bomb guard before the WASM decode: sharp can read HEIF metadata
      // (dimensions) even when its libvips can't decode the pixels, so cap
      // total pixels before heic-convert allocates a full raw bitmap.
      try {
        const meta = await sharp(original, { limitInputPixels: false }).metadata();
        if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS)
          throw new Error("HEIC exceeds pixel limit");
      } catch (metaErr) {
        if (metaErr instanceof Error && metaErr.message === "HEIC exceeds pixel limit") throw metaErr;
        // metadata unreadable — fall through; toMaster still enforces the cap.
      }
      // @types/heic-convert types buffer as ArrayBufferLike; a Node Buffer is
      // accepted at runtime (verified), so cast past the imperfect types.
      const jpeg = Buffer.from(
        await convert({ buffer: original as unknown as ArrayBufferLike, format: "JPEG", quality: 0.95 }),
      );
      ({ data: displayJpeg, info } = await toMaster(jpeg));
    } else {
      throw err;
    }
  }

  const displayPath = `${row.piece_id}/${row.id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(DERIVATIVES_BUCKET)
    .upload(displayPath, displayJpeg, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true, // re-processing (retry) overwrites the previous master
    });
  if (uploadError) {
    throw new Error(`upload to ${DERIVATIVES_BUCKET}/${displayPath} failed: ${uploadError.message}`);
  }

  // Phase 2b: CLIP embedding of the display master → piece_embeddings.
  const embedding = await generateImageEmbedding(displayJpeg);
  if (embedding) {
    // Intentionally unreachable until generateImageEmbedding is implemented.
    log("info", "image embedding generated", { imageId: row.id, dims: embedding.length });
  }

  await pool.query(
    `UPDATE piece_images
        SET storage_path_display = $2,
            width                = $3,
            height               = $4,
            file_size_bytes      = $5,
            exif                 = $6::jsonb,
            processing_status    = 'done',
            processing_error     = NULL
      WHERE id = $1`,
    [row.id, displayPath, info.width, info.height, info.size, JSON.stringify(exif)],
  );

  log("info", "image done", {
    imageId: row.id,
    display: displayPath,
    width: info.width,
    height: info.height,
    bytes: info.size,
    ms: Date.now() - startedAt,
  });
}

// ---------------------------------------------------------------------------
// Work loop — single-flight cycle, woken by NOTIFY or the poll timer
// ---------------------------------------------------------------------------

let shuttingDown = false;
let cycleInFlight: Promise<void> | null = null;
let wakeAgain = false; // a NOTIFY arrived while a cycle was running

async function runCycle(): Promise<void> {
  // Drain: keep claiming batches until nothing is pending.
  for (;;) {
    if (shuttingDown) return;
    let batch: PendingImage[];
    try {
      batch = await claimBatch();
    } catch (err) {
      log("error", "claiming batch failed", { error: errorMessage(err) });
      return;
    }
    if (batch.length === 0) return;
    log("info", "claimed batch", { count: batch.length });

    for (const row of batch) {
      try {
        await processImage(row);
      } catch (err) {
        log("error", "image failed", { imageId: row.id, error: errorMessage(err) });
        await markError(row.id, err);
      }
    }
  }
}

/** Trigger a cycle unless one is already running (then re-run right after). */
function wake(reason: string): void {
  if (shuttingDown) return;
  if (cycleInFlight) {
    wakeAgain = true;
    return;
  }
  log("info", "cycle start", { reason });
  cycleInFlight = runCycle()
    .catch((err) => log("error", "cycle crashed", { error: errorMessage(err) }))
    .finally(() => {
      cycleInFlight = null;
      if (wakeAgain) {
        wakeAgain = false;
        wake("notify (queued)");
      }
    });
}

// ---------------------------------------------------------------------------
// LISTEN new_piece_image — dedicated connection with reconnect backoff
// ---------------------------------------------------------------------------

let listenClient: pg.Client | null = null;

async function startListener(attempt = 0): Promise<void> {
  if (shuttingDown) return;
  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
    listenClient = client;
    log("info", `listening on channel "${NOTIFY_CHANNEL}"`);

    client.on("notification", (msg) => {
      log("info", "notify received", { channel: msg.channel, payload: msg.payload ?? null });
      wake("notify");
    });
    client.on("error", (err) => {
      log("error", "listener connection error", { error: errorMessage(err) });
    });
    client.on("end", () => {
      listenClient = null;
      if (!shuttingDown) {
        log("warn", "listener connection closed; reconnecting");
        void startListener(0);
      }
    });
  } catch (err) {
    const delay = Math.min(30_000, 1_000 * 2 ** attempt);
    log("error", "listener connect failed; retrying", { error: errorMessage(err), retryInMs: delay });
    await client.end().catch(() => undefined);
    setTimeout(() => void startListener(attempt + 1), delay).unref();
  }
}

// ---------------------------------------------------------------------------
// Startup / graceful shutdown
// ---------------------------------------------------------------------------

let pollTimer: NodeJS.Timeout | null = null;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", `received ${signal}; shutting down gracefully`);

  if (pollTimer) clearInterval(pollTimer);

  // Let the in-flight batch finish — images mid-flight would otherwise be
  // stuck in 'processing' until manually reset.
  if (cycleInFlight) {
    log("info", "waiting for in-flight cycle to finish");
    await cycleInFlight;
  }

  await listenClient?.end().catch(() => undefined);
  await pool.end().catch(() => undefined);
  log("info", "shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function main(): Promise<void> {
  log("info", "image-worker starting", {
    supabaseUrl: SUPABASE_URL,
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
    maxDimensionPx: MAX_DIMENSION_PX,
    jpegQuality: JPEG_QUALITY,
  });

  await startListener();

  // Fallback poll: catches rows whose NOTIFY was missed (worker restart,
  // listener reconnect window) — BUILD_PLAN §4 calls for LISTEN + 60s poll.
  pollTimer = setInterval(() => wake("poll"), POLL_INTERVAL_MS);

  // Immediate first sweep on boot.
  wake("startup");
}

void main();

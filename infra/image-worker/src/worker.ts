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
 *     so multiple workers would not double-process) and works through them
 *     CONCURRENCY at a time, per image:
 *       download original → EXIF subset via exifr → sharp: auto-rotate,
 *       sRGB, flattened on white, max 4096px longest side (no enlargement),
 *       JPEG q85 → upload to `piece-derivatives/${piece_id}/${image_id}.jpg`
 *       → update the row (paths, dims, bytes, exif, status 'done').
 *   - A claim is a lease once migration 0099 is applied (claim_piece_images):
 *     a row left 'processing' by a worker that stopped mid-image is taken
 *     again 15 minutes later, a passing storage/network failure is retried a
 *     few minutes later, and after 3 tries the row is marked 'error'. Without
 *     0099 the worker claims and fails as it always did.
 *   - Any other failure marks the row 'error' with the message; a retry is
 *     setting the status back to 'pending'.
 *   - On SIGTERM it finishes the images in hand, hands back the ones of the
 *     batch it had not started ('pending'), and exits. The container runs
 *     node itself as PID 1 (Dockerfile), so the signal reaches this process.
 */

import { createClient } from "@supabase/supabase-js";
import exifr from "exifr";
import convert from "heic-convert";
import pg from "pg";
import sharp, { type OutputInfo } from "sharp";
import { displayMaster } from "./master.js";
import {
  isMissingObject,
  isNotFound,
  isTransient,
  LEASE_SECONDS,
  MAX_ATTEMPTS,
  positiveInt,
  retryDelaySeconds,
  runLimited,
  TransientError,
} from "./runtime.js";
import { safeStoragePath, UUID_PATTERN } from "./storage-path.js";

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

function numberEnv(name: string, fallback: number): number {
  const { value, invalid } = positiveInt(process.env[name], fallback);
  if (invalid) {
    console.warn(
      `[${new Date().toISOString()}] WARN ${name}=${JSON.stringify(process.env[name])} is not a whole number above 0; using ${fallback}`,
    );
  }
  return value;
}

const POLL_INTERVAL_MS = numberEnv("POLL_INTERVAL_MS", 60_000);
const BATCH_SIZE = numberEnv("BATCH_SIZE", 5);
// Images worked on at once. Each holds its original (up to the storage
// limit) and a decoded bitmap in memory, so a whole batch at once could run
// the 8 GB server out of memory.
const CONCURRENCY = numberEnv("CONCURRENCY", 2);

const ORIGINALS_BUCKET = "piece-originals";
const DERIVATIVES_BUCKET = "piece-derivatives";
const NOTIFY_CHANNEL = "new_piece_image";

/**
 * Display master: longest side, never enlarged. Raised from 2560 (BUILD_PLAN
 * §4) to 4096 on 9 October 2026 so the website's full-screen zoom stays sharp;
 * imgproxy's IMGPROXY_MAX_SRC_RESOLUTION (80 MP) leaves ample headroom.
 */
const MAX_DIMENSION_PX = 4096;
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
// An idle pooled connection that drops (a database restart) is reported
// here. Without a listener the 'error' event threw and ended the worker
// mid-batch. The pool has already discarded the client; the next query
// opens a new connection.
pool.on("error", (err) => {
  log("warn", "idle database connection lost", { error: errorMessage(err) });
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingImage {
  id: string;
  piece_id: string;
  storage_path_original: string | null;
  /** Manual quarter-turns applied to the previous derivative (0/90/180/270). */
  rotation: number | null;
  /** This claim's try number (lease mode, migration 0099); absent without it. */
  processing_attempts?: number;
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
 * Whether migration 0099's claim_piece_images() is there. Checked before
 * each claim until it is (cheap), so applying 0099 needs no restart; a claim
 * that finds it gone again drops back to the old claim.
 */
let leaseMode = false;
/** After the lease claim failed: when to look for it again (ms epoch). */
let leaseCheckAfter = 0;

async function detectLeaseMode(): Promise<void> {
  if (leaseMode || Date.now() < leaseCheckAfter) return;
  try {
    const { rows } = await pool.query<{ ok: boolean }>(
      `select to_regprocedure('public.claim_piece_images(integer,integer,integer)') is not null as ok`,
    );
    if (rows[0]?.ok) {
      leaseMode = true;
      log("info", "claims are leases (migration 0099): stranded rows are retried", {
        leaseSeconds: LEASE_SECONDS,
        maxAttempts: MAX_ATTEMPTS,
      });
    }
  } catch (err) {
    log("warn", "could not check for claim_piece_images", { error: errorMessage(err) });
  }
}

/**
 * Atomically claim up to BATCH_SIZE rows by flipping them to 'processing'.
 * SKIP LOCKED makes this safe under concurrent workers. With 0099 it also
 * takes rows whose lease ran out (a worker stopped mid-image).
 */
async function claimBatch(): Promise<PendingImage[]> {
  await detectLeaseMode();
  if (leaseMode) {
    try {
      const result = await pool.query<PendingImage>(
        `select id, piece_id, storage_path_original, rotation, processing_attempts
           from public.claim_piece_images($1, $2, $3)`,
        [BATCH_SIZE, LEASE_SECONDS, MAX_ATTEMPTS],
      );
      return result.rows;
    } catch (err) {
      // Gone again, or not callable by this role: claim as before 0099 and
      // look again in 10 minutes rather than failing every cycle.
      if (!isMissingObject(err)) throw err;
      leaseMode = false;
      leaseCheckAfter = Date.now() + 10 * 60_000;
      log("warn", "claim_piece_images unusable; claiming as before 0099", { error: errorMessage(err) });
    }
  }
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
  RETURNING id, piece_id, storage_path_original, rotation`,
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
  let data: Blob | null = null;
  let error: { message: string } | null = null;
  try {
    ({ data, error } = await supabase.storage.from(ORIGINALS_BUCKET).download(path));
  } catch (err) {
    throw new TransientError(`download from ${ORIGINALS_BUCKET}/${path} failed: ${errorMessage(err)}`);
  }
  if (error || !data) {
    const message = `download from ${ORIGINALS_BUCKET}/${path} failed: ${error?.message ?? "no data"}`;
    // A missing file stays missing; anything else (storage busy, network)
    // may clear.
    throw isNotFound(message) ? new Error(message) : new TransientError(message);
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

/**
 * Lease mode: try again after a delay. The row stays 'processing' with its
 * lease set to run out after `delaySeconds`; the next claim after that takes
 * it as another try. The message is kept for when the tries run out.
 */
async function retryLater(imageId: string, err: unknown, delaySeconds: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE piece_images
          SET processing_started_at = now() - make_interval(secs => $3) + make_interval(secs => $4),
              processing_error      = $2
        WHERE id = $1 AND processing_status = 'processing'`,
      [imageId, errorMessage(err).slice(0, 2000), LEASE_SECONDS, delaySeconds],
    );
  } catch (updateErr) {
    // The lease runs out on its own in 15 minutes; that is the retry then.
    log("error", "failed to schedule retry", { imageId, error: errorMessage(updateErr) });
  }
}

/** Lease mode: the lease counts from when work on the image starts, not the claim. */
async function touchLease(imageId: string): Promise<void> {
  await pool
    .query(`UPDATE piece_images SET processing_started_at = now() WHERE id = $1 AND processing_status = 'processing'`, [
      imageId,
    ])
    .catch((err) => log("warn", "could not renew lease", { imageId, error: errorMessage(err) }));
}

/** Hand claimed rows that were never started back to the queue (shutdown). */
async function release(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await pool.query(
      `UPDATE piece_images SET processing_status = 'pending'
        WHERE id = ANY($1::uuid[]) AND processing_status = 'processing'`,
      [ids],
    );
    log("info", "handed back unstarted images", { count: ids.length });
  } catch (err) {
    log("error", "could not hand back unstarted images", { ids, error: errorMessage(err) });
  }
}

/** After a failure: retry later when it may clear and tries are left, else 'error'. */
async function handleFailure(row: PendingImage, err: unknown): Promise<void> {
  const attempt = row.processing_attempts;
  if (leaseMode && attempt !== undefined && isTransient(err)) {
    if (attempt < MAX_ATTEMPTS) {
      const delay = retryDelaySeconds(attempt);
      log("warn", "image failed; will retry", { imageId: row.id, attempt, retryInSeconds: delay, error: errorMessage(err) });
      await retryLater(row.id, err, delay);
      return;
    }
    await markError(row.id, new Error(`Gave up after ${attempt} tries: ${errorMessage(err)}`));
    return;
  }
  await markError(row.id, err);
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

  // The path comes from the row, which staff write, and this worker holds the
  // service role: only a file directly under the row's own piece in
  // piece-originals is read, never a path that climbs into another bucket
  // (security review 2026-10, F6; migration 0090 holds new rows to the shape).
  const originalPath = new RegExp(`^${UUID_PATTERN}$`).test(row.piece_id)
    ? safeStoragePath(row.storage_path_original, { pattern: new RegExp(`^${row.piece_id}/[^/]+$`) })
    : null;
  if (!originalPath) {
    await markError(row.id, new Error("Original image path is not under this work's own folder; not processed"));
    return;
  }

  const original = await downloadOriginal(originalPath);
  const exif = await extractExif(original);

  // sharp (master.ts): EXIF orientation, then any rotation a human set by
  // hand in the studio (without it a re-derivation silently reverts their
  // correction), transparency on white, sRGB, size cap. TIFF input is
  // handled natively by libvips.
  const manualRotation = (((row.rotation ?? 0) % 360) + 360) % 360;
  const toMaster = (buf: Buffer) =>
    displayMaster(buf, {
      rotation: manualRotation,
      maxDimension: MAX_DIMENSION_PX,
      maxInputPixels: MAX_INPUT_PIXELS,
      quality: JPEG_QUALITY,
    });

  let displayJpeg: Buffer;
  let info: OutputInfo;
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
      const jpeg = Buffer.from(await convert({ buffer: original, format: "JPEG", quality: 0.95 }));
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
    throw new TransientError(`upload to ${DERIVATIVES_BUCKET}/${displayPath} failed: ${uploadError.message}`);
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
    log("info", "claimed batch", { count: batch.length, lease: leaseMode });

    // CONCURRENCY images at a time: overlapping the downloads and uploads
    // drains a bulk upload faster, while the memory each decode takes stays
    // bounded. A failure is isolated per image. Once shutdown starts no new
    // image is begun; those are handed back below.
    const skipped = await runLimited(
      batch,
      CONCURRENCY,
      async (row) => {
        try {
          if (leaseMode) await touchLease(row.id);
          await processImage(row);
        } catch (err) {
          log("error", "image failed", { imageId: row.id, error: errorMessage(err) });
          await handleFailure(row, err);
        }
      },
      () => shuttingDown,
    );
    await release(skipped.map((row) => row.id));
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
  // Listen for errors from the start: an 'error' event with no listener
  // throws and ends the process. The 'end' handler (reconnect) is attached
  // only once connected, so a failed connect does not start a second loop
  // beside the backoff below.
  client.on("error", (err) => {
    log("error", "listener connection error", { error: errorMessage(err) });
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
    listenClient = client;
    log("info", `listening on channel "${NOTIFY_CHANNEL}"`);

    client.on("notification", (msg) => {
      log("info", "notify received", { channel: msg.channel, payload: msg.payload ?? null });
      wake("notify");
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

  // Let the images in hand finish (at most CONCURRENCY); the rest of the
  // batch is handed back as 'pending'. Compose allows 2 minutes for this
  // (stop_grace_period) before it kills the container.
  if (cycleInFlight) {
    log("info", "waiting for in-flight images to finish");
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
    concurrency: CONCURRENCY,
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

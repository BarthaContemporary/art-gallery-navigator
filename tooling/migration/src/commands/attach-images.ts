import fs from "node:fs";
import path from "node:path";
import { getSupabase } from "../lib/db.js";
import { scanImages, type ManifestEntry } from "../lib/images.js";

/**
 * attach-images — upload the exported FileMaker images and wire them to their
 * piece_images stub rows.
 *
 * The finalize step already created one piece_images stub per FileMaker
 * container reference, each carrying `legacy_container_filename` (the original
 * base filename) but no stored original. This command:
 *   1. walks the export directory and indexes files by base filename;
 *   2. for every stub, finds the file whose name matches
 *      legacy_container_filename (exact → case-insensitive; largest wins when a
 *      name repeats, flagged as ambiguous);
 *   3. uploads it to `piece-originals/<piece_id>/<image_id>.<ext>` and sets
 *      storage_path_original + processing_status='pending' on the stub.
 *
 * The image-worker then generates the display master + thumbnails as for any
 * normal studio upload. Idempotent: stubs that already have an original are
 * skipped unless --force.
 */

const BUCKET = "piece-originals";
const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

type Stub = {
  id: string;
  piece_id: string;
  legacy_container_filename: string | null;
  storage_path_original: string | null;
};

const base = (name: string) => path.basename(name.replace(/\\/g, "/")).toLowerCase();

export async function runAttachImages(opts: {
  dir: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<void> {
  if (!fs.existsSync(opts.dir) || !fs.statSync(opts.dir).isDirectory()) {
    console.error(`Not a directory: ${opts.dir}`);
    process.exit(1);
  }

  console.log(`Scanning ${opts.dir} …`);
  const files = await scanImages(opts.dir);
  const byName = new Map<string, ManifestEntry[]>();
  for (const f of files) {
    const k = f.filename.toLowerCase();
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(f);
  }
  console.log(`  ${files.length} files indexed (${byName.size} distinct names).`);

  const supabase = getSupabase();

  // Load every stub (paginate — the range cap is 1000).
  const stubs: Stub[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("piece_images")
      .select("id, piece_id, legacy_container_filename, storage_path_original")
      .order("id")
      .range(from, from + 999);
    if (error) {
      console.error(`Failed to read piece_images: ${error.message}`);
      process.exit(1);
    }
    const batch = (data ?? []) as Stub[];
    stubs.push(...batch);
    if (batch.length < 1000) break;
  }
  console.log(`  ${stubs.length} piece_images stubs.`);

  const stats = { uploaded: 0, skipped: 0, ambiguous: 0, unmatched: 0, errors: 0 };
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

  for (const stub of stubs) {
    if (stub.storage_path_original && !opts.force) {
      stats.skipped++;
      continue;
    }
    const name = stub.legacy_container_filename?.trim();
    if (!name) {
      stats.unmatched++;
      continue;
    }
    const candidates = byName.get(base(name)) ?? [];
    if (candidates.length === 0) {
      stats.unmatched++;
      unmatched.push(name);
      continue;
    }
    // Largest file wins when a base name repeats (usually the full-res copy).
    const chosen = [...candidates].sort((a, b) => b.bytes - a.bytes)[0]!;
    if (candidates.length > 1) {
      stats.ambiguous++;
      ambiguous.push(`${name} → ${candidates.length} files, chose ${chosen.relative_path}`);
    }

    const ext = (path.extname(chosen.filename) || ".jpg").toLowerCase();
    const destPath = `${stub.piece_id}/${stub.id}${ext}`;

    if (opts.dryRun) {
      stats.uploaded++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(path.join(opts.dir, chosen.relative_path));
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(destPath, buffer, {
          contentType: CONTENT_TYPE[ext] ?? "application/octet-stream",
          upsert: true,
        });
      if (upErr) throw new Error(upErr.message);

      const { error: updErr } = await supabase
        .from("piece_images")
        .update({ storage_path_original: destPath, processing_status: "pending", processing_error: null })
        .eq("id", stub.id);
      if (updErr) throw new Error(updErr.message);

      stats.uploaded++;
      if (stats.uploaded % 100 === 0) console.log(`  … ${stats.uploaded} uploaded`);
    } catch (err) {
      stats.errors++;
      console.error(`  ✗ ${name} (${stub.id}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n── attach-images summary ─────────────────────────────");
  console.log(`  uploaded  ${stats.uploaded}${opts.dryRun ? " (dry run — nothing written)" : ""}`);
  console.log(`  skipped   ${stats.skipped} (already had an original)`);
  console.log(`  ambiguous ${stats.ambiguous} (duplicate names — largest chosen)`);
  console.log(`  unmatched ${stats.unmatched} (no file for the stub's filename)`);
  console.log(`  errors    ${stats.errors}`);
  if (unmatched.length)
    console.log(`\n  Unmatched filenames (first 25):\n    ${unmatched.slice(0, 25).join("\n    ")}`);
  if (ambiguous.length)
    console.log(`\n  Ambiguous (first 15):\n    ${ambiguous.slice(0, 15).join("\n    ")}`);
  if (!opts.dryRun)
    console.log(
      "\n  The image-worker will now generate display masters + thumbnails for the pending rows.",
    );
}

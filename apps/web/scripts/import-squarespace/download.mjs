// Step 3: download every image once, at original size.
//
//   node scripts/import-squarespace/download.mjs [--limit N]
//
// The Squarespace CDN serves the original JPEG only when the Accept header
// asks for it (a plain fetch gets a WebP re-encode), so this is done here
// rather than left to the Sanity importer. Files land in .cache/images/ named
// by their Squarespace image id, and existing files are skipped, so the run
// can be interrupted and resumed. Expect ~1,500 files / ~450 MB.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CACHE } from "./crawl.mjs";

const IMAGES = path.join(CACHE, "images");
const UA = "Mozilla/5.0 (compatible; JvdB site migration)";
const ACCEPT = "image/jpeg,image/png;q=0.9,*/*;q=0.1";
const PAUSE_MS = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stable local filename for an image: its Squarespace id, else a URL hash. */
export function imageFile(img) {
  const id = img.imageId || createHash("sha1").update(img.imageUrl).digest("hex").slice(0, 16);
  const ext = /\.(jpe?g|png|gif|webp)$/i.exec(img.imageUrl)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "jpg";
  return path.join(IMAGES, `${id}.${ext}`);
}

export function allImages(content) {
  const out = new Map();
  const add = (img) => {
    if (img?.imageUrl && !out.has(img.imageUrl)) out.set(img.imageUrl, img);
  };
  for (const e of content.exhibitions) {
    add(e.cover);
    for (const c of e.catalogue) add(c);
  }
  for (const p of content.publications) {
    add(p.cover);
    for (const s of p.spreads) add(s);
  }
  add(content.about?.image);
  return [...out.values()];
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  const content = JSON.parse(await fs.readFile(path.join(CACHE, "out", "content.json"), "utf8"));
  await fs.mkdir(IMAGES, { recursive: true });
  const images = allImages(content).slice(0, limit);
  let done = 0, skipped = 0, failed = 0, bytes = 0;
  for (const img of images) {
    const file = imageFile(img);
    try {
      await fs.access(file);
      skipped++;
      continue;
    } catch {}
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await fetch(img.imageUrl, { headers: { "User-Agent": UA, Accept: ACCEPT } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) throw new Error(`suspiciously small (${buf.length} B)`);
        await fs.writeFile(file, buf);
        bytes += buf.length;
        ok = true;
      } catch (err) {
        if (attempt === 3) {
          failed++;
          console.error(`!! ${img.imageUrl}: ${err.message}`);
        } else await sleep(attempt * 1000);
      }
    }
    if (ok) done++;
    if ((done + skipped + failed) % 50 === 0) console.log(`  ${done + skipped + failed}/${images.length}…`);
    await sleep(PAUSE_MS);
  }
  console.log(`downloaded ${done} (${(bytes / 1e6).toFixed(1)} MB), already had ${skipped}, failed ${failed}, of ${images.length} unique images`);
  if (failed) process.exit(1);
}

// Only run when executed directly — build-ndjson.mjs imports imageFile().
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

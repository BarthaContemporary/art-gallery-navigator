// Step 1 of the Squarespace → Sanity migration: fetch everything once and
// cache it locally. Later steps never touch Squarespace again.
//
//   node scripts/import-squarespace/crawl.mjs
//
// Squarespace serves any page as JSON with `?format=json` (no login), and its
// sitemap.xml lists every page with every image on it. Both are cached under
// .cache/ (gitignored) together with the home page HTML, which is the only
// place the navigation titles live.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = process.env.SQUARESPACE_SITE ?? "https://www.joostvandenbergh.com";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, ".cache");
const UA = "Mozilla/5.0 (compatible; JvdB site migration; +https://www.joostvandenbergh.com)";
const PAUSE_MS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, accept = "*/*") {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { status: res.status, text: "" };
      return { status: res.status, text: await res.text() };
    } catch (err) {
      lastErr = err;
      await sleep(attempt * 1500);
    }
  }
  throw lastErr;
}

export function parseSitemap(xml) {
  const pages = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const u = block[1];
    const loc = /<loc>(.*?)<\/loc>/.exec(u)?.[1];
    if (!loc) continue;
    const images = [];
    for (const img of u.matchAll(/<image:image>([\s\S]*?)<\/image:image>/g)) {
      images.push({
        loc: /<image:loc>(.*?)<\/image:loc>/.exec(img[1])?.[1] ?? null,
        title: decode(/<image:title>([\s\S]*?)<\/image:title>/.exec(img[1])?.[1] ?? ""),
        caption: decode(/<image:caption>([\s\S]*?)<\/image:caption>/.exec(img[1])?.[1] ?? ""),
      });
    }
    const pathname = new URL(loc).pathname.replace(/\/$/, "") || "/";
    pages.push({ path: pathname, loc, images });
  }
  return pages;
}

export function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

async function main() {
  await fs.mkdir(path.join(CACHE, "pages"), { recursive: true });

  const sitemap = await fetchText(`${SITE}/sitemap.xml`);
  if (sitemap.status !== 200) throw new Error(`sitemap.xml → HTTP ${sitemap.status}`);
  await fs.writeFile(path.join(CACHE, "sitemap.xml"), sitemap.text);
  const pages = parseSitemap(sitemap.text);
  console.log(`sitemap: ${pages.length} pages, ${pages.reduce((n, p) => n + p.images.length, 0)} image references`);

  const home = await fetchText(`${SITE}/`);
  await fs.writeFile(path.join(CACHE, "home.html"), home.text);

  // Index pages carry the display order; make sure they're in the set.
  const paths = new Set(pages.map((p) => p.path));
  for (const extra of ["/all-exhibitions", "/all-publications", "/about", "/"]) paths.add(extra);

  const manifest = { site: SITE, fetchedAt: new Date().toISOString(), pages: [] };
  for (const p of [...paths].sort()) {
    const file = path.join(CACHE, "pages", `${p === "/" ? "home" : p.slice(1)}.json`);
    const { status, text } = await fetchText(`${SITE}${p}?format=json`, "application/json");
    let ok = status === 200;
    if (ok) {
      try {
        JSON.parse(text);
        await fs.writeFile(file, text);
      } catch {
        ok = false;
      }
    }
    manifest.pages.push({ path: p, status, ok, bytes: text.length });
    console.log(`${ok ? "ok " : "!! "} ${status} ${p} (${text.length} B)`);
    await sleep(PAUSE_MS);
  }
  await fs.writeFile(path.join(CACHE, "manifest.json"), JSON.stringify(manifest, null, 2));
  const failed = manifest.pages.filter((p) => !p.ok);
  console.log(`\ncached ${manifest.pages.length - failed.length} pages` + (failed.length ? `, ${failed.length} FAILED: ${failed.map((f) => f.path).join(", ")}` : ""));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Step 2: turn the cached Squarespace pages into structured content.
//
//   node scripts/import-squarespace/parse.mjs
//
// Produces, under .cache/out/:
//   content.json            everything the upload step needs
//   review-works.csv        one row per catalogue entry (check the parsed fields)
//   review-exhibitions.csv  one row per exhibition (fill in venue and dates)
//   review-publications.csv one row per catalogue publication
// and writes redirects/squarespace.json (committed) mapping every old URL to
// its new one.
//
// Nothing here talks to the network or to Sanity.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE, decode, parseSitemap } from "./crawl.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(CACHE, "out");
const REDIRECTS_FILE = path.join(HERE, "..", "..", "redirects", "squarespace.json");

// Squarespace's default demo copy, still present on the newer pages.
const PLACEHOLDER = [
  /whatever it is, the way you tell your story/i,
  /make it stand out/i,
  /it all begins with an idea/i,
  /maybe you want to launch a business/i,
];
const isPlaceholder = (s) => PLACEHOLDER.some((re) => re.test(s ?? ""));

/* ------------------------------------------------------------------ */
/* Small text utilities                                                 */
/* ------------------------------------------------------------------ */

const stripTags = (h) => decode(h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
const clean = (s) =>
  (s ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

export function slugify(s) {
  return clean(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/, "");
}

/* ------------------------------------------------------------------ */
/* Squarespace markup extraction                                        */
/* ------------------------------------------------------------------ */

function attr(html, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(html);
  return m ? decode(m[1]) : null;
}

/** Gallery block slides: the catalogue of works on an exhibition page. */
function gallerySlides(mainContent) {
  const gallery = /<div class="sqs-block gallery-block[\s\S]*/.exec(mainContent)?.[0];
  if (!gallery) return [];
  const parts = gallery.split(/<div class="slide[" ]/).slice(1);
  const slides = [];
  for (const part of parts) {
    const image = attr(part, "data-image") ?? attr(part, "data-src");
    if (!image) continue;
    const description = attr(part, "data-description");
    const title = attr(part, "data-title");
    const captionHtml = description || title || "";
    const rawCaption = clean(stripTags(captionHtml));
    slides.push({
      imageUrl: image.split("?")[0],
      imageId: attr(part, "data-image-id"),
      dimensions: attr(part, "data-image-dimensions"),
      href: /href="(\/[a-z0-9-]+)"/.exec(part)?.[1] ?? null, // index grids link out
      rawCaption,
      captionHtml,
    });
  }
  return slides;
}

/** Stand-alone image blocks: openers on exhibitions, cover + spreads on catalogues. */
function imageBlocks(mainContent) {
  const out = [];
  for (const m of mainContent.matchAll(/<div class="sqs-block image-block[\s\S]*?(?=<div class="sqs-block |$)/g)) {
    const block = m[0];
    const image = attr(block, "data-image") ?? attr(block, "data-src");
    if (!image) continue;
    const figcaption = /<figcaption[\s\S]*?>([\s\S]*?)<\/figcaption>/.exec(block)?.[1];
    const caption = clean(stripTags(figcaption ?? ""));
    out.push({
      imageUrl: image.split("?")[0],
      imageId: attr(block, "data-image-id"),
      dimensions: attr(block, "data-image-dimensions"),
      caption: isPlaceholder(caption) ? "" : caption,
    });
  }
  return out;
}

/** Text blocks, as arrays of paragraphs (placeholder copy removed). */
function textBlocks(mainContent) {
  const out = [];
  for (const m of mainContent.matchAll(/<div class="sqs-block html-block[\s\S]*?<div class="sqs-block-content">([\s\S]*?)<\/div>\s*<\/div>/g)) {
    const paras = [...m[1].matchAll(/<(?:p|h[1-4])[^>]*>([\s\S]*?)<\/(?:p|h[1-4])>/g)]
      .map((p) => clean(stripTags(p[1])))
      .filter((t) => t && !isPlaceholder(t) && !/^\s*$/.test(t));
    if (paras.length) out.push(paras);
  }
  return out;
}

/** Navigation titles from the home page header: path → title. */
function navTitles(homeHtml) {
  const map = new Map();
  const header = /<(?:nav|header)[\s\S]*?<\/(?:nav|header)>/g;
  for (const block of homeHtml.matchAll(header)) {
    for (const a of block[0].matchAll(/href="(\/[^"#?]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const title = clean(stripTags(a[2]));
      if (title && !map.has(a[1])) map.set(a[1], title);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Caption parsing                                                      */
/* ------------------------------------------------------------------ */

// SHO02, MSG01, T26-01, EST56A, ACOP1
const REF_RE = /^[A-Z]{1,6}\s?\d{1,3}(?:-\d{1,3})?[A-Za-z]?$/;
const DIMS_RE = /(\d+(?:[.,]\d+)?\s*(?:cm|mm|in\b|inches|″|")|\b[hwdl]:\s*\d|\bheight\b|\bwidth\b|\bdiam(?:eter)?\b|\bdepth\b|\d+\s*[x×]\s*\d+)/i;
const ORIGIN_RE = /\b(century|period|dynasty|millennium|circa|c\.\s?\d|\bBC\b|\bAD\b|\bCE\b|\d{2,4}s\b|india|japan|nepal|tibet|china|korea|burma|myanmar|thailand|sri lanka|ceylon|pakistan|afghanistan|kashmir|rajasthan|gujarat|bengal|deccan|tamil|kerala|karnataka|orissa|odisha|bihar|punjab|himachal|maharashtra|west(?:ern)? india|south india|north india|central india|eastern india|showa|meiji|edo|taisho|heisei|gandhara|bactria)\b/i;
// "ASANO Yae (1914–96)", "ISHITAKA Yasuo (1944–)", "Alison Wilding RA"
const MAKER_DATES_RE = /^(.*?)\s*\(((?:c\.\s?)?\d{4}\s*[–-]\s*(?:\d{2,4})?|\d{4})\)\s*$/;
const SURNAME_CAPS_RE = /^[A-Z][A-Z'’-]{2,}(?:\s[A-Z][A-Za-z'’-]+)+/; // "ASANO Yae", "MAEDA Koichiro"

function splitRef(seg) {
  const sold = /\bSOLD\b/i.test(seg);
  const s = seg.replace(/\bSOLD\b/gi, "").replace(/[()]/g, "").trim();
  return { ref: REF_RE.test(s) ? s.replace(/\s+/, "") : null, sold };
}

function parseMaker(seg) {
  const m = MAKER_DATES_RE.exec(seg);
  if (m) return { maker: clean(m[1]), makerDates: clean(m[2]).replace(/\s*[–-]\s*/, "–") };
  return { maker: clean(seg), makerDates: null };
}

function looksLikeMaker(seg) {
  return MAKER_DATES_RE.test(seg) || SURNAME_CAPS_RE.test(seg) || /\b(RA|OBE|CBE)\b$/.test(seg);
}

/**
 * Three caption generations share one shape — pipe-separated, reference code
 * at one end, "SOLD" appended — so one parser with a confidence score covers
 * them. Anything it can't place stays in rawCaption for the review sheet.
 */
export function parseCaption(raw) {
  const entry = {
    reference: null, title: null, maker: null, makerDates: null, medium: null,
    originAndDate: null, dimensions: null, sold: false, confidence: "low", rawCaption: raw,
  };
  if (!raw || isPlaceholder(raw)) return { ...entry, confidence: "none" };
  let segs = raw.split("|").map((s) => clean(s)).filter(Boolean);
  if (segs.length === 1) {
    // Some older captions use " / " or newlines instead of pipes.
    segs = raw.split(/\n|\s\/\s/).map((s) => clean(s)).filter(Boolean);
  }
  if (segs.length === 0) return { ...entry, confidence: "none" };

  entry.sold = /\bSOLD\b/i.test(raw);
  // Reference code: last segment (generations A/B) or first (generation C).
  const last = splitRef(segs[segs.length - 1]);
  const first = splitRef(segs[0]);
  let profile;
  if (last.ref) {
    entry.reference = last.ref;
    segs = segs.slice(0, -1);
    profile = "AB";
  } else if (first.ref) {
    entry.reference = first.ref;
    segs = segs.slice(1);
    profile = "C";
  } else {
    profile = "none";
  }
  segs = segs.map((s) => s.replace(/\bSOLD\b/gi, "").trim()).filter(Boolean);

  // Dimensions: the segment that talks about cm / height / width.
  const dimsIdx = segs.findIndex((s) => DIMS_RE.test(s) && !ORIGIN_RE.test(s.replace(DIMS_RE, "")));
  if (dimsIdx >= 0) {
    entry.dimensions = segs[dimsIdx];
    segs.splice(dimsIdx, 1);
  }

  if (profile === "C") {
    // T26-01 | ISHITAKA Yasuo (1944–) | Copper hand-hammered vase [| ...]
    if (segs[0] && looksLikeMaker(segs[0])) {
      Object.assign(entry, parseMaker(segs.shift()));
    }
    if (segs.length) entry.title = segs.shift();
    if (segs.length) entry.medium = segs.shift();
    if (segs.length) entry.originAndDate = segs.join(", ");
  } else {
    // Title | Medium | Origin, date  — or —  Maker | Title | Medium | dims
    if (segs.length >= 3 && looksLikeMaker(segs[0]) && !looksLikeMaker(segs[1])) {
      Object.assign(entry, parseMaker(segs.shift()));
    }
    if (segs.length) entry.title = segs.shift();
    // "Title, 2019" carries the date for contemporary works — leave in title.
    const rest = segs;
    if (rest.length >= 2) {
      entry.medium = rest[0];
      entry.originAndDate = rest.slice(1).join(", ");
    } else if (rest.length === 1) {
      if (ORIGIN_RE.test(rest[0]) && !/\b(paper|canvas|bronze|silver|gold|wood|lacquer|ink|gouache|oil|silk|cotton|stone|ceramic|porcelain|iron|copper|brass|steel|glass|ivory|jade|crystal|textile|watercolour|acrylic|pencil|print|photograph)\b/i.test(rest[0])) {
        entry.originAndDate = rest[0];
      } else {
        entry.medium = rest[0];
      }
    }
    // "Maker (dates)" hiding inside the title slot (no separate segment).
    if (!entry.maker && entry.title && MAKER_DATES_RE.test(entry.title) && SURNAME_CAPS_RE.test(entry.title)) {
      Object.assign(entry, parseMaker(entry.title));
      entry.title = null;
    }
  }

  const placed = [entry.title, entry.maker, entry.medium, entry.originAndDate, entry.dimensions].filter(Boolean).length;
  entry.confidence =
    entry.reference && entry.dimensions && placed >= 3 ? "high" : entry.reference || placed >= 2 ? "medium" : "low";
  return entry;
}

/* ------------------------------------------------------------------ */
/* Page-level interpretation                                            */
/* ------------------------------------------------------------------ */

const FAIR_RE = /\b(TEFAF|Frieze|Masterpiece|Asian Art in London|PAD|BRAFA|Art Basel)\b/i;

function readPage(json) {
  const coll = json.collection ?? {};
  return {
    path: `/${coll.urlId ?? ""}`,
    pageTitle: clean(coll.title ?? ""),
    mainContent: json.mainContent ?? "",
  };
}

function exhibitionMeta(title) {
  const m = /^(.*?)\s*[–-]\s*(TEFAF|Frieze(?: Masters)?|Masterpiece|BRAFA)\s*(?:Maastricht\s*)?(\d{4})\s*$/i.exec(title);
  if (m) {
    return {
      shortTitle: clean(m[1]),
      subtitle: null,
      isArtFair: true,
      fairName: `${m[2].toUpperCase() === "TEFAF" ? "TEFAF Maastricht" : m[2]} ${m[3]}`,
      venue: m[2].toUpperCase() === "TEFAF" ? "MECC, Maastricht" : null,
      year: Number(m[3]),
    };
  }
  // "A Concentration of Power - curated by Alexander Gorlizki" → title + subtitle.
  const sub = /^(.*?)\s+[–-]\s+(curated by .*|works by .*|new work .*)$/i.exec(title);
  if (sub) {
    return {
      shortTitle: clean(sub[1]),
      subtitle: clean(sub[2]).replace(/^([a-z])/, (c) => c.toUpperCase()),
      isArtFair: false,
      fairName: null,
      venue: null,
      year: null,
    };
  }
  return { shortTitle: title, subtitle: null, isArtFair: FAIR_RE.test(title), fairName: null, venue: null, year: null };
}

/** The part of a title before an en/em dash: "Showa – TEFAF 2024" → "Showa". */
const shortOf = (title) => clean(title.split(/\s+[–—]\s+|\s+-\s+/)[0] ?? title);

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const sitemap = parseSitemap(await fs.readFile(path.join(CACHE, "sitemap.xml"), "utf8"));
  const nav = navTitles(await fs.readFile(path.join(CACHE, "home.html"), "utf8"));
  const pages = new Map();
  const emptyPages = [];
  for (const f of await fs.readdir(path.join(CACHE, "pages"))) {
    const json = JSON.parse(await fs.readFile(path.join(CACHE, "pages", f), "utf8"));
    if (typeof json.mainContent !== "string") {
      // A page with no body (e.g. an unused template page) — redirect only.
      emptyPages.push(`/${json.collection?.urlId ?? f.replace(/\.json$/, "")}`);
      continue;
    }
    const p = readPage(json);
    if (p.path !== "/") pages.set(p.path, p);
    else pages.set("/home", p);
  }

  // Display order: the navigation lists everything newest-first and is kept
  // current; the index grids lag behind it, so they only supply covers.
  const navOrder = new Map([...nav.keys()].map((p, i) => [p, i]));
  const orderFrom = (p) => {
    const idx = pages.get(p);
    if (!idx) return new Map();
    return new Map(gallerySlides(idx.mainContent).map((s, i) => [s.href, { order: i, cover: s.imageUrl, coverId: s.imageId }]).filter(([h]) => h));
  };
  const exhibitionIndex = orderFrom("/all-exhibitions");
  const publicationIndex = orderFrom("/all-publications");
  const sortOrderFor = (p, idx, fallback) =>
    navOrder.has(p) ? navOrder.get(p) : idx ? 1000 + idx.order : 2000 + fallback;

  const SKIP = new Set(["/all-exhibitions", "/all-publications", "/home", "/about", "/exhibitions", "/publications"]);
  const exhibitions = [];
  const publications = [];
  const duplicates = []; // { path, of }

  const classify = (p) => (p.path.match(/-cat(?:-\d+)?$/) ? "publication" : "exhibition");

  for (const page of [...pages.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    if (SKIP.has(page.path)) continue;
    const kind = classify(page);
    const navTitle = nav.get(page.path) ?? null;
    const isCopy = /\(copy\)/i.test(page.pageTitle) || /-copy(?:-\d+)?$/.test(page.path);
    const baseTitle = clean(page.pageTitle.replace(/\s*\(copy\)\s*/gi, ""));

    if (kind === "exhibition") {
      const title = navTitle ?? baseTitle;
      const meta = exhibitionMeta(title);
      const slides = gallerySlides(page.mainContent).filter((s) => !isPlaceholder(s.rawCaption));
      const openers = imageBlocks(page.mainContent);
      const intro = textBlocks(page.mainContent).flat();
      const idx = exhibitionIndex.get(page.path);
      const listed = Boolean(idx) || nav.has(page.path);
      exhibitions.push({
        path: page.path,
        title: meta.isArtFair ? title : meta.shortTitle,
        slug: slugify(meta.isArtFair ? title : meta.shortTitle),
        isCopy,
        baseTitle,
        indexed: listed,
        sortOrder: sortOrderFor(page.path, idx, exhibitions.length),
        cover: openers[0] ?? (idx ? { imageUrl: idx.cover, imageId: idx.coverId, caption: "" } : null),
        intro,
        ...meta,
        catalogue: slides.map((s, i) => ({
          order: i,
          imageUrl: s.imageUrl,
          imageId: s.imageId,
          dimensions: s.dimensions,
          filename: decodeURIComponent(s.imageUrl.split("/").pop() ?? ""),
          ...parseCaption(s.rawCaption),
        })),
      });
    } else {
      const texts = textBlocks(page.mainContent).flat();
      const images = imageBlocks(page.mainContent);
      const detailsLine = texts.find((t) => /published\s+\d{4}|\d+\s+pages|\d+\s*[x×]\s*\d+\s*cm/i.test(t));
      const titleLine = texts.find((t) => t !== detailsLine && t.length < 120) ?? null;
      const year = Number(/(?:published\s+)?(\d{4})/i.exec(detailsLine ?? "")?.[1]) || null;
      const pagesN = Number(/(\d+)\s+pages/i.exec(detailsLine ?? "")?.[1]) || null;
      const format = /(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*cm[^|]*)/i.exec(detailsLine ?? "")?.[1]?.replace(/\s*x\s*/i, " × ").trim() ?? null;
      const description = texts.filter((t) => t !== detailsLine && t !== titleLine);
      const title = titleLine ?? clean((navTitle ?? baseTitle).replace(/\s+cat$/i, ""));
      const idx = publicationIndex.get(page.path);
      publications.push({
        path: page.path,
        stem: page.path.replace(/-cat(?:-\d+)?$/, ""),
        title,
        navTitle,
        slug: slugify(shortOf(title)),
        isCopy,
        baseTitle,
        indexed: Boolean(idx) || nav.has(page.path),
        sortOrder: sortOrderFor(page.path, idx, publications.length),
        publishedYear: year,
        pages: pagesN,
        format,
        detailsLine: detailsLine ?? null,
        description,
        cover: images[0] ?? (idx ? { imageUrl: idx.cover, imageId: idx.coverId, caption: "" } : null),
        spreads: images.slice(1),
      });
    }
  }

  // Duplicates: "(Copy)" pages, or a second page with an identical title.
  const dedupe = (list) => {
    const seen = new Map();
    for (const item of list.sort((a, b) => Number(a.isCopy) - Number(b.isCopy) || a.sortOrder - b.sortOrder)) {
      const key = slugify(item.baseTitle || item.title);
      const canonical = seen.get(key);
      if (canonical && (item.isCopy || !item.indexed)) {
        item.duplicateOf = canonical.path;
        duplicates.push({ path: item.path, of: canonical.path });
      } else if (!canonical) {
        seen.set(key, item);
      }
    }
    return list.filter((i) => !i.duplicateOf);
  };
  const exhibitionsOut = dedupe(exhibitions);
  const publicationsOut = dedupe(publications);

  // Unique slugs.
  const taken = new Set();
  for (const list of [exhibitionsOut, publicationsOut]) {
    for (const item of list) {
      let s = item.slug || "untitled";
      let n = 2;
      while (taken.has(`${list === exhibitionsOut ? "e" : "p"}:${s}`)) s = `${item.slug}-${n++}`;
      item.slug = s;
      taken.add(`${list === exhibitionsOut ? "e" : "p"}:${s}`);
    }
  }

  // Pair each catalogue with its exhibition: same URL stem, or the same
  // short title ("Showa" ↔ "Showa – TEFAF 2024"). Deliberately no fuzzy
  // matching — "Japanese 20th Century Design" has four different catalogues
  // across the years and only one of them belongs to the exhibition page.
  for (const pub of publicationsOut) {
    const pubShort = slugify(shortOf(pub.title));
    const match =
      exhibitionsOut.find((e) => e.path === pub.stem || e.path === `${pub.stem}-1`) ??
      exhibitionsOut.find((e) => slugify(e.shortTitle) === pubShort || slugify(e.title) === slugify(pub.title));
    pub.exhibitionPath = match?.path ?? null;
    pub.exhibitionSlug = match?.slug ?? null;
    if (match && !pub.publishedYear && match.year) pub.publishedYear = match.year;
    // A catalogue of a show shares the show's slug.
    if (match) pub.slug = match.slug;
  }
  // Re-check slug uniqueness after pairing.
  const seenSlugs = new Set();
  for (const pub of publicationsOut) {
    let s = pub.slug;
    let n = 2;
    while (seenSlugs.has(s)) s = `${pub.slug}-${n++}`;
    pub.slug = s;
    seenSlugs.add(s);
  }

  // About page.
  const about = pages.get("/about");
  const aboutOut = about
    ? {
        // The contact line lives in siteSettings on the new site, not in the body.
        paragraphs: textBlocks(about.mainContent).flat().filter((p) => !/^contact:/i.test(p)),
        image: imageBlocks(about.mainContent)[0] ?? null,
      }
    : null;

  // Redirects for every old URL.
  const redirects = [
    { source: "/home", destination: "/" },
    { source: "/all-exhibitions", destination: "/exhibitions" },
    { source: "/all-publications", destination: "/publications" },
  ];
  const target = (p) => {
    const e = exhibitionsOut.find((x) => x.path === p);
    if (e) return `/exhibitions/${e.slug}`;
    const pub = publicationsOut.find((x) => x.path === p);
    if (pub) return `/publications/${pub.slug}`;
    const dup = duplicates.find((d) => d.path === p);
    if (dup) return target(dup.of);
    return null;
  };
  for (const p of [...sitemap.map((s) => s.path), ...emptyPages]) {
    if (redirects.some((r) => r.source === p) || p === "/about" || p === "/") continue;
    const dest = target(p);
    redirects.push({ source: p, destination: dest ?? (p.endsWith("-cat") ? "/publications" : "/exhibitions") });
  }

  const content = { generatedAt: new Date().toISOString(), exhibitions: exhibitionsOut, publications: publicationsOut, about: aboutOut, duplicates, redirects };
  await fs.writeFile(path.join(OUT, "content.json"), JSON.stringify(content, null, 2));
  await fs.mkdir(path.dirname(REDIRECTS_FILE), { recursive: true });
  await fs.writeFile(REDIRECTS_FILE, JSON.stringify(redirects, null, 2) + "\n");

  // Review sheets.
  const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
  const works = [["exhibition", "exhibition_slug", "order", "reference", "maker", "maker_dates", "title", "medium", "origin_and_date", "dimensions", "sold", "confidence", "raw_caption", "image_filename", "image_id", "image_url"]];
  for (const e of exhibitionsOut) for (const c of e.catalogue) works.push([e.title, e.slug, c.order + 1, c.reference, c.maker, c.makerDates, c.title, c.medium, c.originAndDate, c.dimensions, c.sold ? "yes" : "", c.confidence === "none" ? "no caption on old site" : c.confidence, c.rawCaption, c.filename, c.imageId, c.imageUrl]);
  await fs.writeFile(path.join(OUT, "review-works.csv"), csv(works));

  const ex = [["slug", "title", "subtitle", "old_path", "listed", "sort_order", "is_art_fair", "fair_name", "venue (fill in)", "start_date (fill in YYYY-MM-DD)", "end_date (fill in)", "works", "works_with_captions", "has_cover", "hidden"]];
  for (const e of exhibitionsOut) ex.push([e.slug, e.title, e.subtitle, e.path, e.indexed ? "yes" : "no", e.sortOrder, e.isArtFair ? "yes" : "", e.fairName, e.venue, "", "", e.catalogue.length, e.catalogue.filter((c) => c.confidence !== "none").length, e.cover ? "yes" : "no", e.indexed ? "" : "yes"]);
  await fs.writeFile(path.join(OUT, "review-exhibitions.csv"), csv(ex));

  const pu = [["slug", "title", "old_path", "in_index", "sort_order", "paired_exhibition", "published_year", "pages", "format", "details_line", "spreads", "has_cover", "hidden"]];
  for (const p of publicationsOut) pu.push([p.slug, p.title, p.path, p.indexed ? "yes" : "no", p.sortOrder, p.exhibitionSlug, p.publishedYear, p.pages, p.format, p.detailsLine, p.spreads.length, p.cover ? "yes" : "no", p.indexed ? "" : "yes"]);
  await fs.writeFile(path.join(OUT, "review-publications.csv"), csv(pu));

  const entries = exhibitionsOut.reduce((n, e) => n + e.catalogue.length, 0);
  const conf = { high: 0, medium: 0, low: 0, none: 0 };
  for (const e of exhibitionsOut) for (const c of e.catalogue) conf[c.confidence]++;
  console.log(`exhibitions: ${exhibitionsOut.length} (${duplicates.length} duplicates dropped)`);
  console.log(`publications: ${publicationsOut.length}, paired: ${publicationsOut.filter((p) => p.exhibitionPath).length}`);
  console.log(`catalogue entries: ${entries} — confidence high ${conf.high}, medium ${conf.medium}, low ${conf.low}, none ${conf.none}`);
  console.log(`spreads: ${publicationsOut.reduce((n, p) => n + p.spreads.length, 0)}, redirects: ${redirects.length}`);
  console.log(`about: ${aboutOut?.paragraphs.length ?? 0} paragraphs`);
  console.log(`\nwrote ${OUT}/{content.json,review-*.csv} and ${path.relative(process.cwd(), REDIRECTS_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

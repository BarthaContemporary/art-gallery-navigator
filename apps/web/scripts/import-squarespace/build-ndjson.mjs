// Step 4: turn content.json (+ the gallery's corrections) into a Sanity
// import file.
//
//   node scripts/import-squarespace/build-ndjson.mjs
//   pnpm exec sanity dataset import scripts/import-squarespace/.cache/out/import.ndjson production --replace
//
// Corrections: save the edited review sheets as CSV into .cache/in/ with the
// same names (review-works.csv, review-exhibitions.csv, review-publications.csv).
// Rows are matched by image id / slug and their cells override the parsed
// values — an empty cell means "leave as parsed", the word "clear" empties it.
//
// Document ids are deterministic (exhibition-sq-<slug>, publication-sq-<slug>,
// page-sq-about), and images are referenced as `_sanityAsset` file paths, so
// `sanity dataset import --replace` can be run as often as needed: the
// importer de-duplicates assets by content hash and replaces the documents.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CACHE } from "./crawl.mjs";
import { imageFile } from "./download.mjs";

const OUT = path.join(CACHE, "out");
const IN = path.join(CACHE, "in");

/* --- tiny CSV reader (RFC 4180 quoting) ---------------------------------- */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

async function readOverrides(name) {
  try {
    return parseCsv(await fs.readFile(path.join(IN, name), "utf8"));
  } catch {
    return null;
  }
}

/** Apply one CSV cell to a field: "" keeps the parsed value, "clear" empties it. */
function applyCell(target, key, cell, { bool = false, num = false } = {}) {
  if (cell === undefined || cell === "") return;
  if (/^clear$/i.test(cell)) { target[key] = null; return; }
  if (bool) target[key] = /^(yes|y|true|1|x)$/i.test(cell);
  else if (num) target[key] = Number(cell) || null;
  else target[key] = cell;
}

/* --- Sanity value builders --------------------------------------------- */
const key = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);

async function imageRef(img, caption) {
  if (!img?.imageUrl) return undefined;
  const file = imageFile(img);
  let source = `file://${file}`;
  try { await fs.access(file); } catch { source = img.imageUrl; } // fall back to remote fetch
  return {
    _type: "image",
    asset: { _sanityAsset: `image@${source}` },
    ...(caption ? { caption } : {}),
  };
}

function portableText(paragraphs) {
  return paragraphs.filter(Boolean).map((text, i) => ({
    _type: "block",
    _key: key(`${i}:${text}`),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: key(`s${i}:${text}`), text, marks: [] }],
  }));
}

const slug = (s) => ({ _type: "slug", current: s });
const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

async function main() {
  const content = JSON.parse(await fs.readFile(path.join(OUT, "content.json"), "utf8"));
  await fs.mkdir(IN, { recursive: true });

  // --- corrections -----------------------------------------------------
  const worksIn = await readOverrides("review-works.csv");
  const exIn = await readOverrides("review-exhibitions.csv");
  const pubIn = await readOverrides("review-publications.csv");
  let applied = 0;

  if (exIn) {
    for (const row of exIn) {
      const e = content.exhibitions.find((x) => x.slug === row.slug);
      if (!e) continue;
      applyCell(e, "title", row.title); applyCell(e, "subtitle", row.subtitle);
      applyCell(e, "venue", row["venue (fill in)"]); applyCell(e, "fairName", row.fair_name);
      applyCell(e, "isArtFair", row.is_art_fair, { bool: true });
      applyCell(e, "startDate", row["start_date (fill in YYYY-MM-DD)"]); applyCell(e, "endDate", row["end_date (fill in)"]);
      applyCell(e, "hidden", row.hidden, { bool: true });
      applied++;
    }
  }
  if (worksIn) {
    for (const row of worksIn) {
      const e = content.exhibitions.find((x) => x.slug === row.exhibition_slug);
      const c = e?.catalogue.find((x) => (x.imageId && x.imageId === row.image_id) || x.imageUrl === row.image_url);
      if (!c) continue;
      applyCell(c, "reference", row.reference); applyCell(c, "maker", row.maker); applyCell(c, "makerDates", row.maker_dates);
      applyCell(c, "title", row.title); applyCell(c, "medium", row.medium); applyCell(c, "originAndDate", row.origin_and_date);
      applyCell(c, "dimensions", row.dimensions); applyCell(c, "sold", row.sold, { bool: true });
      applied++;
    }
  }
  if (pubIn) {
    for (const row of pubIn) {
      const p = content.publications.find((x) => x.slug === row.slug);
      if (!p) continue;
      applyCell(p, "title", row.title); applyCell(p, "publishedYear", row.published_year, { num: true });
      applyCell(p, "pages", row.pages, { num: true }); applyCell(p, "format", row.format);
      applyCell(p, "exhibitionSlug", row.paired_exhibition); applyCell(p, "hidden", row.hidden, { bool: true });
      applied++;
    }
  }

  // --- documents -------------------------------------------------------
  const docs = [];
  for (const e of content.exhibitions) {
    const catalogue = [];
    for (const c of e.catalogue) {
      const image = await imageRef(c, c.rawCaption && c.confidence === "none" ? undefined : undefined);
      if (!image) continue;
      catalogue.push(drop({
        _type: "catalogueEntry",
        _key: c.imageId ?? key(c.imageUrl),
        image,
        reference: c.reference, title: c.title, maker: c.maker, makerDates: c.makerDates,
        medium: c.medium, originAndDate: c.originAndDate, dimensions: c.dimensions,
        sold: c.sold || undefined,
        rawCaption: c.rawCaption || undefined,
      }));
    }
    docs.push(drop({
      _id: `exhibition-sq-${e.slug}`,
      _type: "exhibition",
      title: e.title,
      slug: slug(e.slug),
      subtitle: e.subtitle,
      venue: e.venue,
      startDate: e.startDate, endDate: e.endDate,
      isArtFair: e.isArtFair || undefined,
      fairName: e.fairName,
      coverImage: await imageRef(e.cover, e.cover?.caption),
      intro: e.intro?.length ? portableText(e.intro) : undefined,
      catalogue,
      hidden: e.hidden ?? !e.indexed ? true : undefined,
      sortOrder: e.sortOrder,
      legacyUrl: e.path,
    }));
  }
  for (const p of content.publications) {
    const spreads = [];
    for (const s of p.spreads) {
      const image = await imageRef(s, s.caption);
      if (image) spreads.push({ _key: s.imageId ?? key(s.imageUrl), ...image });
    }
    const related = p.exhibitionSlug && content.exhibitions.some((e) => e.slug === p.exhibitionSlug)
      ? { _type: "reference", _ref: `exhibition-sq-${p.exhibitionSlug}` }
      : undefined;
    docs.push(drop({
      _id: `publication-sq-${p.slug}`,
      _type: "publication",
      title: p.title,
      slug: slug(p.slug),
      coverImage: await imageRef(p.cover, p.cover?.caption),
      description: p.description?.length ? portableText(p.description) : undefined,
      spreads,
      publishedYear: p.publishedYear,
      pages: p.pages,
      format: p.format,
      relatedExhibition: related,
      hidden: p.hidden ?? !p.indexed ? true : undefined,
      sortOrder: p.sortOrder,
      legacyUrl: p.path,
    }));
  }
  if (content.about) {
    docs.push(drop({
      _id: "page-sq-about",
      _type: "page",
      title: "About",
      slug: slug("about"),
      body: [
        ...(content.about.image ? [{ _key: key("about-image"), ...(await imageRef(content.about.image)) }] : []),
        ...portableText(content.about.paragraphs),
      ],
    }));
  }

  const ndjson = docs.map((d) => JSON.stringify(d)).join("\n") + "\n";
  await fs.writeFile(path.join(OUT, "import.ndjson"), ndjson);
  const assets = ndjson.match(/_sanityAsset/g)?.length ?? 0;
  const remote = ndjson.match(/image@https:/g)?.length ?? 0;
  console.log(`${docs.length} documents → ${path.relative(process.cwd(), path.join(OUT, "import.ndjson"))}`);
  console.log(`${assets} image references (${assets - remote} local files, ${remote} still remote — run download.mjs to fetch originals)`);
  console.log(`corrections applied from .cache/in: ${applied} rows${worksIn || exIn || pubIn ? "" : " (no review CSVs found — parsed values used as-is)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/*
 * Open the preview studio's command palette (start.mjs must be running) and
 * record what it offers for a list of queries: the groups in order, each
 * option's label and detail line, any status line ("No matches.", a failed
 * search), and what /api/search answered. For checking a palette or search
 * change against the fixtures, before and after (--compare).
 *
 * Options:
 *   --queries "a|b|c"   the queries, separated by "|" (default: a full stock
 *                       number, "0003", "yosai" and a contact's email, all
 *                       from the fixtures)
 *   --role admin,staff  who is signed in; one pass per role (default both)
 *   --path /            the page the palette is opened on (default /)
 *   --out <dir>         where palette.json goes (default .run/palette/<time>)
 *   --shots             also save a JPEG of the open palette per role and query
 *   --compare <file>    an earlier palette.json: list what changed since
 *   --width <px>        viewport width (default 1280)
 *
 * Localhost only, like shoot.mjs: the studio's address must be loopback,
 * Chromium's own traffic goes to a proxy that does not exist, and every
 * request off loopback is aborted. The preview runs without OpenSearch
 * (start.mjs sets no OPENSEARCH_* variable), so this records the Postgres
 * side of search, answered by the mock from the fixtures.
 *
 * The page is read through ARIA, not class names: the dialog holding a
 * combobox, its listbox, role="option" rows, and as group headings
 * role="group" labels, headings, or the role="presentation" lines the
 * palette draws between groups. Text inside aria-hidden elements (the ⏎
 * hint) is left out.
 *
 * Exit status 1 when a query could not be read (no palette, a failed or
 * missing search answer, sign-in lost, an uncaught page error).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sessionCookies } from "./lib/session.mjs";
import { blockOffLocalhost, isLocal, launchBrowser, trackNetwork } from "./lib/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures", "data");

// ----------------------------------------------------------------- options

function opt(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const flag = (name) => process.argv.includes(name);

/**
 * The fixtures are generated deterministically (fixtures/generate.mjs), so
 * these stay put: 2024-0003 is one work (and "0003" a dozen across the years
 * and both registers), Yokota Yōsai's works are found by "yosai" only when
 * the accent is folded, and Lucy Quennell is a contact with that address.
 */
const DEFAULT_QUERIES = ["2024-0003", "0003", "yosai", "lucy.quennell@example.com"];

const queries = (opt("--queries", null) ? String(opt("--queries")).split("|") : DEFAULT_QUERIES).map((q) => q.trim()).filter(Boolean);
const roles = String(opt("--role", "admin,staff")).split(",").map((r) => r.trim()).filter(Boolean);
const pagePath = String(opt("--path", "/"));
const outDir = path.resolve(opt("--out", path.join(HERE, ".run", "palette", new Date().toISOString().replace(/[:.]/g, "-"))));
const shots = flag("--shots");
const compareWith = opt("--compare", null);
const width = Number(opt("--width", 1280)) || 1280;

if (roles.length === 0 || roles.some((r) => !["admin", "staff"].includes(r))) {
  console.error("--role must be admin, staff or both (admin,staff)");
  process.exit(2);
}
if (queries.length === 0) {
  console.error("No queries.");
  process.exit(2);
}
if (!pagePath.startsWith("/")) {
  console.error("--path must start with /");
  process.exit(2);
}

const catalogue = JSON.parse(fs.readFileSync(path.join(HERE, "routes.json"), "utf8"));
const baseUrl = String(process.env.PREVIEW_BASE_URL ?? catalogue.baseUrl).replace(/\/+$/, "");
if (!/^https?:/.test(baseUrl) || !isLocal(baseUrl)) {
  console.error(`The studio address must be on this machine (localhost, 127.0.0.1 or [::1]), not ${baseUrl}.`);
  process.exit(2);
}

/** Says when a default query no longer matches the fixtures it was chosen from. */
function checkDefaults() {
  if (opt("--queries", null)) return;
  try {
    const read = (t) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${t}.json`), "utf8"));
    const works = [...read("pieces"), ...read("external_pieces")];
    if (!works.some((p) => p.stock_number === DEFAULT_QUERIES[0])) console.warn(`note: no fixture work is ${DEFAULT_QUERIES[0]}`);
    if (!read("makers").some((m) => /yōsai/i.test(m.display_name ?? ""))) console.warn("note: no fixture maker is called Yōsai");
    if (!read("crm_contacts").some((c) => c.email === DEFAULT_QUERIES[3])) console.warn(`note: no fixture contact has ${DEFAULT_QUERIES[3]}`);
  } catch (e) {
    console.warn(`note: could not read the fixtures (${String(e?.message ?? e)})`);
  }
}

// ------------------------------------------------------------ in the page

/**
 * The open palette as data. Runs in the page: plain DOM, no closures over
 * this module.
 */
function readPalette() {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('[role="combobox"], input'));
  if (!dialog) return null;
  const hiddenSel = '[aria-hidden]:not([aria-hidden="false"])';
  const linesOf = (el) => {
    const hidden = new Set([...el.querySelectorAll(hiddenSel)].map((h) => h.innerText.trim()).filter(Boolean));
    return (el.innerText ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !hidden.has(s));
  };
  const input = dialog.querySelector('[role="combobox"]') ?? dialog.querySelector("input");
  const activeId = input?.getAttribute("aria-activedescendant") ?? null;
  const listbox = dialog.querySelector('[role="listbox"]');

  const groups = [];
  let current = null;
  const open = (heading) => {
    current = { heading, options: [], notes: [] };
    groups.push(current);
  };
  // Elements that name a group (aria-labelledby): read as its heading, not as a note.
  const labels = new Set();
  const labelOf = (el) => {
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const ids = by.split(/\s+/).filter(Boolean);
      for (const id of ids) labels.add(id);
      const text = ids
        .map((id) => document.getElementById(id)?.innerText.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }
    return el.getAttribute("aria-label");
  };
  const headingLike = (el) =>
    !el.querySelector('[role="option"]') &&
    (el.getAttribute("role") === "heading" || /^H[1-6]$/.test(el.tagName) || el.getAttribute("role") === "presentation") &&
    el.innerText.trim() !== "";
  const walk = (el) => {
    for (const child of el.children) {
      if (child.matches(hiddenSel) || (child.id && labels.has(child.id))) continue;
      const role = child.getAttribute("role");
      if (role === "option") {
        if (!current) open(null);
        const [label = "", ...rest] = linesOf(child);
        const link = child.matches("a[href]") ? child : child.querySelector("a[href]");
        current.options.push({
          label,
          detail: rest.length ? rest.join(" · ") : null,
          selected: child.getAttribute("aria-selected") === "true" || (activeId != null && child.id === activeId),
          disabled: child.getAttribute("aria-disabled") === "true",
          href: link ? link.getAttribute("href") : null,
        });
      } else if (role === "group") {
        open(labelOf(child));
        walk(child);
        current = null;
      } else if (headingLike(child)) {
        open(child.innerText.trim().replace(/\s+/g, " "));
      } else if (child.children.length === 0 && child.innerText?.trim()) {
        // Loose text between rows (a "showing similar" line, say).
        if (!current) open(null);
        current.notes.push(child.innerText.trim().replace(/\s+/g, " "));
      } else {
        walk(child);
      }
    }
  };
  if (listbox) walk(listbox);
  const statuses = [...dialog.querySelectorAll('[role="status"], [role="alert"]')]
    .map((s) => s.innerText.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  return {
    query: input?.value ?? null,
    expanded: input?.getAttribute("aria-expanded") ?? null,
    groups: groups.filter((g) => g.options.length || g.notes.length || g.heading),
    statuses,
  };
}

// --------------------------------------------------------------------- run

async function openPalette(page) {
  const box = () => page.locator('[role="dialog"]').filter({ has: page.locator('[role="combobox"], input') });
  if (await box().count()) return box();
  // ⌘K / Ctrl-K, as staff open it (the palette listens on the window); the
  // header button's event as a fallback.
  await page.keyboard.press("Control+k");
  try {
    await box().first().waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    await page.evaluate(() => window.dispatchEvent(new Event("jvb:command-palette")));
    await box().first().waitFor({ state: "visible", timeout: 10_000 });
  }
  return box();
}

async function closePalette(page) {
  await page.keyboard.press("Escape");
  await page
    .locator('[role="dialog"]')
    .filter({ has: page.locator('[role="combobox"], input') })
    .first()
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {});
}

/** Waits until the palette has looked the query up and drawn the answer. */
async function searchFor(page, net, searches, q) {
  const dialog = await openPalette(page);
  const field = dialog.locator('[role="combobox"], input').first();
  await field.fill("");
  const t0 = Date.now();
  const since = searches.length;
  await field.fill(q);

  // The palette waits for a pause in typing before it asks; a query it does
  // not send (too short, say) is recorded with no answer.
  const mine = () => searches.slice(since).find((s) => s.q === q);
  while (!mine() && Date.now() - t0 < 3_000) await page.waitForTimeout(100);
  const sent = mine();
  if (sent) {
    // next dev compiles /api/search on its first call.
    while (!sent.done && Date.now() - t0 < 120_000) await page.waitForTimeout(100);
  }
  // Then until the list stops changing and nothing is in flight.
  let last = null;
  let stableSince = Date.now();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const snap = JSON.stringify(await page.evaluate(readPalette));
    if (snap !== last) {
      last = snap;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= 500 && net.quietFor(400) && !/Searching/i.test(snap)) {
      break;
    }
    await page.waitForTimeout(120);
  }
  const palette = await page.evaluate(readPalette);
  return { sent, palette, ms: Date.now() - t0 };
}

const slug = (s) => s.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "q";

async function runRole(browser, role) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/London",
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("jvb-theme", "light");
    } catch {}
  });
  await context.addCookies(sessionCookies(role).map((c) => ({ ...c, url: baseUrl, sameSite: "Lax" })));
  await blockOffLocalhost(context);

  const page = await context.newPage();
  const net = trackNetwork(page);
  const pageErrors = [];
  const consoleErrors = [];
  const blocked = new Set();
  page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err).slice(0, 600)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/net::ERR_BLOCKED_BY_CLIENT/.test(text)) return;
    consoleErrors.push(text.slice(0, 600));
  });
  page.on("requestfailed", (req) => {
    if (!isLocal(req.url())) blocked.add(new URL(req.url()).host);
  });

  // Every /api/search call, with its answer.
  const searches = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (!isLocal(req.url()) || !u.pathname.startsWith("/api/search")) return;
    searches.push({ req, q: u.searchParams.get("q"), path: u.pathname + u.search, started: Date.now(), done: false });
  });
  const finish = async (req, res) => {
    const s = searches.find((x) => x.req === req);
    if (!s) return;
    s.status = res ? res.status() : null;
    s.ms = Date.now() - s.started;
    if (res) {
      try {
        s.body = await res.json();
      } catch {
        s.body = null;
      }
    }
    s.done = true;
  };
  page.on("response", (res) => void finish(res.request(), res));
  page.on("requestfailed", (req) => void finish(req, null));

  const result = { role, page: pagePath, queries: [], pageErrors, consoleErrors, blockedExternalHosts: [] };
  let navError = null;
  try {
    await page.goto(baseUrl + pagePath, { waitUntil: "load", timeout: 240_000 });
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000 && !net.quietFor(1_200)) await page.waitForTimeout(150);
  } catch (e) {
    navError = String(e?.message ?? e).split("\n")[0];
  }
  const finalPath = (() => {
    try {
      const u = new URL(page.url());
      return u.pathname + u.search;
    } catch {
      return page.url();
    }
  })();
  if (navError || /^\/login(\?|$)/.test(finalPath)) {
    result.error = navError ?? `sent to sign-in (${finalPath})`;
  } else {
    for (const q of queries) {
      const entry = { q, ok: false };
      try {
        const { sent, palette, ms } = await searchFor(page, net, searches, q);
        entry.ms = ms;
        entry.api = sent ? { path: sent.path, status: sent.status ?? null, ms: sent.ms ?? null, body: sent.body ?? null } : null;
        entry.palette = palette;
        entry.ok = palette != null && (sent == null || sent.status === 200);
        if (!palette) entry.error = "the palette did not open";
        else if (sent && !sent.done) entry.error = "no answer from /api/search";
        else if (sent && sent.status !== 200) entry.error = `/api/search answered ${sent.status}`;
        if (shots) {
          const file = `${role}--${slug(q)}.jpg`;
          await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 80 }).catch(() => {});
          entry.screenshot = file;
        }
      } catch (e) {
        entry.error = String(e?.message ?? e).split("\n")[0];
      }
      await closePalette(page);
      result.queries.push(entry);
      printEntry(role, entry);
    }
  }
  result.blockedExternalHosts = [...blocked];
  await context.close();
  return result;
}

// ----------------------------------------------------------------- output

/** A query's palette as lines: "Heading: label — detail", the way --compare diffs it. */
function shape(entry) {
  const lines = [];
  for (const g of entry.palette?.groups ?? []) {
    const h = g.heading ?? "(no heading)";
    if (!g.options.length && !g.notes.length) lines.push(`${h}: (empty)`);
    for (const o of g.options) lines.push(`${h}: ${o.label}${o.detail ? ` — ${o.detail}` : ""}${o.href ? ` → ${o.href}` : ""}`);
    for (const n of g.notes) lines.push(`${h}: [${n}]`);
  }
  for (const s of entry.palette?.statuses ?? []) lines.push(`status: ${s}`);
  if (entry.error) lines.push(`error: ${entry.error}`);
  return lines;
}

function printEntry(role, entry) {
  const api = entry.api ? `/api/search ${entry.api.status ?? "?"}${entry.api.ms != null ? ` in ${entry.api.ms} ms` : ""}` : "no search sent";
  process.stdout.write(`\n${entry.ok ? "ok " : "BAD"} ${role.padEnd(5)} "${entry.q}"  ${api}\n`);
  const keys = entry.api?.body && typeof entry.api.body === "object" ? Object.entries(entry.api.body) : [];
  if (keys.length) {
    process.stdout.write(`    answer: ${keys.map(([k, v]) => `${k} ${Array.isArray(v) ? v.length : JSON.stringify(v)}`).join(", ")}\n`);
  }
  for (const g of entry.palette?.groups ?? []) {
    process.stdout.write(`    ${g.heading ?? "(no heading)"}${g.options.length ? "" : " (empty)"}\n`);
    for (const o of g.options) {
      process.stdout.write(`      ${o.selected ? ">" : " "} ${o.label}${o.detail ? `  [${o.detail}]` : ""}${o.href ? `  → ${o.href}` : ""}\n`);
    }
    for (const n of g.notes) process.stdout.write(`        (${n})\n`);
  }
  for (const s of entry.palette?.statuses ?? []) process.stdout.write(`    status: ${s}\n`);
  if (entry.error) process.stdout.write(`    error: ${entry.error}\n`);
}

function compare(prev, report) {
  const index = (r) => new Map(r.roles.flatMap((x) => x.queries.map((q) => [`${x.role}\u0000${q.q}`, q])));
  const before = index(prev);
  const after = index(report);
  let changed = 0;
  process.stdout.write(`\nCompared with ${compareWith}\n`);
  for (const [key, entry] of after) {
    const [role, q] = key.split("\u0000");
    const old = before.get(key);
    if (!old) {
      process.stdout.write(`  new     ${role} "${q}"\n`);
      continue;
    }
    const a = shape(old);
    const b = shape(entry);
    if (JSON.stringify(a) === JSON.stringify(b)) {
      process.stdout.write(`  same    ${role} "${q}"\n`);
      continue;
    }
    changed++;
    process.stdout.write(`  CHANGED ${role} "${q}"\n`);
    for (const l of a) if (!b.includes(l)) process.stdout.write(`    - ${l}\n`);
    for (const l of b) if (!a.includes(l)) process.stdout.write(`    + ${l}\n`);
    if (a.every((l) => b.includes(l)) && b.every((l) => a.includes(l))) process.stdout.write("    (same rows, another order)\n");
  }
  for (const key of before.keys()) {
    if (!after.has(key)) {
      const [role, q] = key.split("\u0000");
      process.stdout.write(`  gone    ${role} "${q}"\n`);
    }
  }
  return changed;
}

// ------------------------------------------------------------------- main

checkDefaults();
fs.mkdirSync(outDir, { recursive: true });
const startedAt = new Date().toISOString();
const browser = await launchBrowser();
const results = [];
try {
  for (const role of roles) results.push(await runRole(browser, role));
} finally {
  await browser.close();
}
const report = { startedAt, finishedAt: new Date().toISOString(), baseUrl, page: pagePath, width, queries, roles: results };
const file = path.join(outDir, "palette.json");
fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
const shown = path.relative(process.cwd(), file);
process.stdout.write(`\nWrote ${shown.startsWith("..") ? file : shown}\n`);

if (compareWith) {
  const prev = JSON.parse(fs.readFileSync(path.resolve(String(compareWith)), "utf8"));
  compare(prev, report);
}

const failed = results.some((r) => r.error || r.pageErrors.length || r.queries.some((q) => !q.ok));
for (const r of results) {
  if (r.error) console.error(`${r.role}: ${r.error}`);
  if (r.pageErrors.length) console.error(`${r.role}: ${r.pageErrors.length} uncaught page error(s), first: ${r.pageErrors[0]}`);
  if (r.blockedExternalHosts.length) console.error(`${r.role}: blocked requests to ${r.blockedExternalHosts.join(", ")}`);
}
process.exit(failed ? 1 : 0);

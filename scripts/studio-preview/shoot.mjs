#!/usr/bin/env node
/*
 * Screenshot the preview studio (start.mjs must be running) and write a
 * report of what each page did.
 *
 * Options:
 *   --routes <file|list>  routes.json (default) or a comma list of paths/names
 *                         (looked up in routes.json for their metadata)
 *   --areas a,b           only routes in these area tags
 *   --match <regex>       only routes whose path or name matches (with
 *                         --areas, a route matching either is kept)
 *   --out <dir>           output directory (default .run/shots/<timestamp>)
 *   --widths 375,768,1024,1440  viewport widths (up to 1024 a touch device;
 *                         1024 is an iPad in landscape, 768 high)
 *   --schemes light,dark  colour schemes
 *   --role admin|staff    who is signed in (default admin)
 *   --full                full page, capped at 8000 px high
 *   --concurrency <n>     viewports shot in parallel (default 3)
 *   --no-warm             skip compiling every route once before shooting
 *   --merge               fold these results into an existing report.json in
 *                         --out (same route, width and scheme replaced), to
 *                         re-shoot a few pages without redoing the set
 *
 * playwright-core comes from PLAYWRIGHT_CORE (its package directory) when
 * set, else from a normal import. Chromium is CHROMIUM when set, else the
 * Playwright build in /opt/pw-browsers if present, else Playwright's own.
 *
 * Every request off localhost is aborted, so nothing reaches a live service;
 * the hosts a page tried are listed per shot. report.json records, per route
 * and size: HTTP status, final URL (a redirect to /login fails the shot),
 * console errors, uncaught errors, whether the error boundary or a 404
 * rendered, failed same-origin requests, and horizontal overflow.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sessionCookies } from "./lib/session.mjs";
import { blockOffLocalhost, isLocal, launchBrowser, trackNetwork } from "./lib/browser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ----------------------------------------------------------------- options

function opt(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}
const flag = (name) => process.argv.includes(name);

const routesArg = opt("--routes", path.join(HERE, "routes.json"));
const outDir = path.resolve(opt("--out", path.join(HERE, ".run", "shots", new Date().toISOString().replace(/[:.]/g, "-"))));
const widths = String(opt("--widths", "375,768,1024,1440")).split(",").map(Number).filter(Boolean);
const schemes = String(opt("--schemes", "light,dark")).split(",").filter((s) => s === "light" || s === "dark");
const role = String(opt("--role", "admin"));
const full = flag("--full");
const concurrency = Math.max(1, Number(opt("--concurrency", 3)) || 3);
const areas = opt("--areas", null);
const match = opt("--match", null);
const warm = !flag("--no-warm");
const merge = flag("--merge");
const MAX_HEIGHT = 8000;

if (!["admin", "staff"].includes(role)) {
  console.error("--role must be admin or staff");
  process.exit(2);
}

// ------------------------------------------------------------------ routes

const catalogue = JSON.parse(fs.readFileSync(path.join(HERE, "routes.json"), "utf8"));
let baseUrl = process.env.PREVIEW_BASE_URL ?? catalogue.baseUrl;
let routes;
// A file, not merely a path that exists: "--routes /" names the dashboard, not the root folder.
if (fs.existsSync(routesArg) && fs.statSync(routesArg).isFile()) {
  const file = JSON.parse(fs.readFileSync(routesArg, "utf8"));
  routes = file.routes ?? file;
  baseUrl = process.env.PREVIEW_BASE_URL ?? file.baseUrl ?? baseUrl;
} else {
  routes = String(routesArg)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((key) => catalogue.routes.find((r) => r.path === key || r.name === key) ?? { name: key.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "root", path: key, area: "adhoc" });
}
if (areas || match) {
  const wanted = areas ? new Set(String(areas).split(",")) : null;
  const re = match ? new RegExp(String(match)) : null;
  routes = routes.filter((r) => (wanted && wanted.has(r.area)) || (re && (re.test(r.path) || re.test(r.name ?? ""))));
}
if (routes.length === 0) {
  console.error("No routes selected.");
  process.exit(2);
}

// -------------------------------------------------------------- playwright

// lib/browser.mjs: playwright-core and Chromium found without an install, and
// every connection off loopback refused (a dead proxy, and the per-context
// route block in newContext below).
const browser = await launchBrowser();

// ----------------------------------------------------------------- helpers

function slug(r) {
  return (r.name ?? r.path).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "root";
}

// Phone portrait, tablet portrait, tablet landscape (1024 x 768), desktop.
const heightFor = (w) => (w < 600 ? 812 : w < 1024 ? 1024 : w === 1024 ? 768 : 900);

async function newContext(width, scheme, signedIn) {
  // Up to 1024 the viewport is a touch device (an iPad in landscape is 1024
  // wide), so pointer: coarse applies and controls take their touch sizes.
  const mobile = width <= 1024;
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: scheme,
    locale: "en-GB",
    timezoneId: "Europe/London",
  });
  // The studio's no-flash script reads the saved theme before first paint.
  await context.addInitScript((s) => {
    try {
      localStorage.setItem("jvb-theme", s);
    } catch {}
  }, scheme);
  if (signedIn) {
    await context.addCookies(sessionCookies(role).map((c) => ({ ...c, url: baseUrl, sameSite: "Lax" })));
  }
  await blockOffLocalhost(context);
  return context;
}

async function settle(page, net) {
  const t0 = Date.now();
  while (Date.now() - t0 < 45_000 && !net.quietFor(1_200)) await page.waitForTimeout(150);
  await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  // Entrance animations (jvb-rise and friends) finish before the shot.
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming?.().iterations === Infinity), null, { timeout: 5_000 })
    .catch(() => {});
  await page.waitForTimeout(250);
}

async function shootOne(context, route, width, scheme) {
  const page = await context.newPage();
  const net = trackNetwork(page);
  const consoleErrors = [];
  const pageErrors = [];
  const blocked = new Set();
  const failedRequests = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const at = msg.location()?.url ?? "";
    if (at && !isLocal(at)) return; // a blocked external resource; listed below
    const text = msg.text();
    if (/net::ERR_BLOCKED_BY_CLIENT/.test(text)) return;
    consoleErrors.push(text.slice(0, 600));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err).slice(0, 600)));
  page.on("requestfailed", (req) => {
    if (!isLocal(req.url())) blocked.add(new URL(req.url()).host);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (isLocal(url) && res.status() >= 400 && res.request().resourceType() !== "document") {
      failedRequests.push(`${res.status()} ${res.request().method()} ${url.replace(baseUrl, "")}`.slice(0, 300));
    }
  });

  const t0 = Date.now();
  let response = null;
  let navError = null;
  try {
    response = await page.goto(baseUrl + route.path, { waitUntil: "load", timeout: 180_000 });
  } catch (e) {
    navError = String(e?.message ?? e).split("\n")[0];
  }
  await settle(page, net);

  const finalUrl = page.url();
  const finalPath = (() => {
    try {
      const u = new URL(finalUrl);
      return u.pathname + u.search;
    } catch {
      return finalUrl;
    }
  })();
  const probe = await page
    .evaluate(() => {
      const text = document.body?.innerText ?? "";
      return {
        errorBoundary: text.includes("The page hit an error.") || text.includes("Application error: a client-side exception has occurred"),
        notFound: text.includes("This page could not be found"),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        height: document.documentElement.scrollHeight,
        title: document.title,
      };
    })
    .catch(() => ({ errorBoundary: false, notFound: false, scrollWidth: 0, innerWidth: 0, height: 0, title: "" }));

  // Hide next dev's own badge and overlay host; errors are in the report.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  const file = `${slug(route)}--${width}-${scheme}.jpg`;
  const shotOpts = { path: path.join(outDir, file), type: "jpeg", quality: 72, fullPage: full };
  if (full && probe.height > MAX_HEIGHT) shotOpts.clip = { x: 0, y: 0, width, height: MAX_HEIGHT };
  let shotError = null;
  await page.screenshot(shotOpts).catch((e) => {
    shotError = String(e?.message ?? e).split("\n")[0];
  });

  const status = response?.status() ?? null;
  const toLogin = route.session !== false && /^\/login(\?|$)/.test(finalPath);
  const ok = !navError && !shotError && status === 200 && !toLogin && !probe.errorBoundary && !probe.notFound && pageErrors.length === 0;
  await page.close();
  return {
    width,
    scheme,
    ok,
    status,
    finalUrl: finalPath,
    redirected: finalPath !== route.path,
    redirectedToLogin: toLogin,
    errorBoundary: probe.errorBoundary,
    notFound: probe.notFound,
    consoleErrors: [...new Set(consoleErrors)],
    pageErrors: [...new Set(pageErrors)],
    failedRequests: [...new Set(failedRequests)],
    blockedExternalHosts: [...blocked],
    // Against the width asked for, not innerWidth: on a touch viewport
    // Chromium widens the layout viewport to fit content that overflows, so
    // innerWidth grows with the overflow and would hide it.
    overflow: { horizontal: probe.scrollWidth > width, scrollWidth: probe.scrollWidth, innerWidth: probe.innerWidth },
    pageHeight: probe.height,
    truncatedAt: full && probe.height > MAX_HEIGHT ? MAX_HEIGHT : null,
    title: probe.title,
    navError,
    shotError,
    screenshot: shotError ? null : file,
    ms: Date.now() - t0,
  };
}

// --------------------------------------------------------------------- run

fs.mkdirSync(outDir, { recursive: true });
const startedAt = new Date().toISOString();

if (warm) {
  // next dev compiles a route on its first request; doing that here keeps the
  // first screenshot of each route from waiting on the compiler.
  const cookie = sessionCookies(role).map((c) => `${c.name}=${c.value}`).join("; ");
  for (const r of routes) {
    const t = Date.now();
    await fetch(baseUrl + r.path, { headers: r.session === false ? {} : { cookie }, redirect: "manual", signal: AbortSignal.timeout(240_000) }).catch(() => {});
    process.stdout.write(`warm ${r.path} ${Date.now() - t} ms\n`);
  }
}

const combos = [];
for (const scheme of schemes) for (const width of widths) combos.push({ scheme, width });
const results = new Map(routes.map((r) => [r, []]));

/**
 * next dev restarts itself when its heap nears the limit, dropping whatever
 * was in flight; such a shot says nothing about the page, so it is taken
 * again once the server answers.
 */
const DROPPED = /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_INCOMPLETE_CHUNKED_ENCODING|ERR_EMPTY_RESPONSE/;
const droppedByServer = (res) => res.status == null || res.consoleErrors.some((e) => DROPPED.test(e)) || /ERR_CONNECTION|ERR_EMPTY_RESPONSE/.test(res.navError ?? "");

async function serverBack(timeoutMs = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/login`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
      if (res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function runCombo({ scheme, width }) {
  const signedIn = await newContext(width, scheme, true);
  let signedOut = null;
  for (const r of routes) {
    let ctx = signedIn;
    if (r.session === false) ctx = signedOut ??= await newContext(width, scheme, false);
    let res = await shootOne(ctx, r, width, scheme);
    if (!res.ok && droppedByServer(res) && (await serverBack())) {
      const first = res;
      res = await shootOne(ctx, r, width, scheme);
      res.retriedAfter = first.navError ?? first.consoleErrors.find((e) => DROPPED.test(e)) ?? `status ${first.status}`;
    }
    results.get(r).push(res);
    const mark = res.ok ? "ok " : "BAD";
    process.stdout.write(`${mark} ${String(res.status)} ${width} ${scheme.padEnd(5)} ${r.path}${res.redirected ? ` -> ${res.finalUrl}` : ""}${res.pageErrors.length ? `  [${res.pageErrors.length} uncaught]` : ""}${res.consoleErrors.length ? `  [${res.consoleErrors.length} console]` : ""}${res.overflow.horizontal ? "  [overflow]" : ""}\n`);
  }
  await signedIn.close();
  if (signedOut) await signedOut.close();
}

const queue = [...combos];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await runCombo(queue.shift());
  }),
);
await browser.close();

const order = (a, b) => schemes.indexOf(a.scheme) - schemes.indexOf(b.scheme) || a.width - b.width;
let report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  baseUrl,
  role,
  widths,
  schemes,
  fullPage: full,
  maxHeight: full ? MAX_HEIGHT : null,
  routes: routes.map((r) => ({
    name: r.name ?? null,
    path: r.path,
    area: r.area ?? null,
    adminOnly: Boolean(r.adminOnly),
    variant: r.variant ?? null,
    redirectsTo: r.redirectsTo ?? null,
    results: results.get(r).sort(order),
  })),
};
if (merge && fs.existsSync(path.join(outDir, "report.json"))) {
  const prev = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf8"));
  if (prev.role !== role || prev.fullPage !== full) {
    console.error(`--merge: ${outDir}/report.json was shot as ${prev.role}${prev.fullPage ? ", full page" : ""}; not merging into it.`);
    process.exit(1);
  }
  for (const fresh of report.routes) {
    const old = prev.routes.find((x) => x.path === fresh.path);
    if (!old) {
      prev.routes.push(fresh);
      continue;
    }
    for (const res of fresh.results) {
      const i = old.results.findIndex((x) => x.width === res.width && x.scheme === res.scheme);
      if (i === -1) old.results.push(res);
      else old.results[i] = { ...res, mergedAt: new Date().toISOString() };
    }
  }
  report = { ...prev, widths: [...new Set([...prev.widths, ...widths])].sort((a, b) => a - b), schemes: [...new Set([...prev.schemes, ...schemes])], mergedAt: new Date().toISOString() };
}
const all = report.routes.flatMap((r) => r.results.map((x) => ({ ...x, path: r.path })));
report.summary = {
  shots: all.length,
  ok: all.filter((x) => x.ok).length,
  failures: all.filter((x) => !x.ok).map((x) => `${x.path} ${x.width} ${x.scheme}: status ${x.status}${x.redirectedToLogin ? ", sent to /login" : ""}${x.errorBoundary ? ", error boundary" : ""}${x.notFound ? ", 404 page" : ""}${x.pageErrors.length ? `, ${x.pageErrors.length} uncaught` : ""}${x.navError ? `, ${x.navError}` : ""}`),
  withConsoleErrors: [...new Set(all.filter((x) => x.consoleErrors.length).map((x) => x.path))],
  horizontalOverflow: all.filter((x) => x.overflow.horizontal).map((x) => `${x.path} ${x.width} ${x.scheme} (${x.overflow.scrollWidth} > ${x.width})`),
};
fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.summary.ok}/${report.summary.shots} shots ok. Report: ${path.join(outDir, "report.json")}`);
if (report.summary.failures.length) console.log(`Failures:\n  ${report.summary.failures.join("\n  ")}`);

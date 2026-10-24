#!/usr/bin/env node
/*
 * Checks, in a real browser, that the web addresses of the private pages (a
 * private offer /o/<token>, the newsletter confirmation) never reach
 * Plausible or the Meta pixel: not on landing, not as the next page's
 * referrer, not on Back and Forward, and nothing after consent is withdrawn
 * (security review 2026-10, F25). Also posts the public forms' single-line
 * cases to their routes (F9).
 *
 *   node apps/web/scripts/private-pages-check/run.mjs [--port 3999]
 *
 * Starts the website under `next dev` on 127.0.0.1 with a deliberately small
 * environment (no Supabase, Sanity, Resend or Turnstile keys) and
 * block-net.cjs preloaded, so the server cannot reach any live service, and
 * stops it at the end. Refuses to start if apps/web has a .env file next.js
 * would load. In the browser every request off this machine is aborted;
 * Plausible's and Meta's scripts are stand-ins served from here, which
 * behave like the real ones where it matters:
 *   - Plausible: the manual tracker sends a page view only when asked, the
 *     standard one (script.js) also on every pushState and popstate;
 *   - Meta: fbevents.js takes over the fbq() queue, and unless
 *     fbq.disablePushState is set sends a PageView on every history change;
 *     unless autoConfig is off it also reports clicks.
 * Run against the code before the fix, the Back, Forward and withdrawal
 * checks fail with the private address in the events.
 *
 * Without a database the forms answer 500 "could not send" once a request
 * has passed validation, and 400 when a field is refused.
 *
 * playwright-core comes from PLAYWRIGHT_CORE (its package directory) when
 * set, else from a normal import; Chromium is CHROMIUM when set, else the
 * Playwright build in /opt/pw-browsers if present, else Playwright's own.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../..");
const i = process.argv.indexOf("--port");
const PORT = Number(i > -1 ? process.argv[i + 1] : 3999);
const base = `http://127.0.0.1:${PORT}`;

for (const f of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  if (fs.existsSync(path.join(WEB, f))) {
    console.error(`apps/web/${f} exists. next dev would load it, and it may hold live credentials; move it aside first.`);
    process.exit(1);
  }
}

async function loadPlaywright() {
  const fromEnv = process.env.PLAYWRIGHT_CORE;
  if (fromEnv) {
    const entry = fs.statSync(fromEnv).isDirectory() ? path.join(fromEnv, "index.mjs") : fromEnv;
    return import(pathToFileURL(entry).href);
  }
  try {
    return await import("playwright-core");
  } catch {
    console.error("playwright-core not found. Set PLAYWRIGHT_CORE to its package directory (no install into the repo is needed).");
    process.exit(2);
  }
}
function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const known = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return fs.existsSync(known) ? known : undefined;
}

/* ------------------------------------------------------------------ */
/* The website, offline                                                 */
/* ------------------------------------------------------------------ */

function startSite() {
  const env = {};
  for (const k of ["PATH", "HOME", "USER", "LANG", "TMPDIR", "SHELL", "TERM"]) if (process.env[k] != null) env[k] = process.env[k];
  Object.assign(env, {
    NODE_OPTIONS: `--require ${path.join(HERE, "block-net.cjs")}`,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: base,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: "joostvandenbergh.com",
    NEXT_PUBLIC_PLAUSIBLE_SRC: "https://analytics.joostvandenbergh.com/js/script.js",
    FACEBOOK_PIXEL_ID: "1234567890123",
  });
  const next = path.join(WEB, "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", String(PORT)], { cwd: WEB, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, log: () => log };
}

async function waitFor(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (r.status > 0) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Stand-ins for the trackers                                           */
/* ------------------------------------------------------------------ */

const FAKE_PLAUSIBLE = (manual) => `(function () {
  var s = document.currentScript;
  var q = (window.plausible && window.plausible.q) || [];
  function send(n, o) {
    fetch("https://analytics.joostvandenbergh.com/api/event", { method: "POST", body: JSON.stringify({
      n: n, u: (o && o.u) || location.href, r: document.referrer || null, d: s && s.getAttribute("data-domain") }) });
  }
  window.plausible = send;
  for (var i = 0; i < q.length; i++) send.apply(this, q[i]);
  ${manual ? "" : `send("pageview");
  var ps = history.pushState; history.pushState = function () { ps.apply(this, arguments); send("pageview"); };
  window.addEventListener("popstate", function () { send("pageview"); });`}
})();`;

const FAKE_FBEVENTS = `(function () {
  var f = window.fbq, auto = true;
  function send(ev, how) {
    fetch("https://www.facebook.com/tr/?ev=" + ev + "&how=" + how + "&dl=" + encodeURIComponent(location.href) + "&rl=" + encodeURIComponent(document.referrer));
  }
  function handle(args) {
    var a = Array.prototype.slice.call(args);
    if (a[0] === "set" && a[1] === "autoConfig" && a[2] === false) auto = false;
    if (a[0] === "track") send(a[1], "track");
  }
  f.callMethod = function () { handle(arguments); };
  var q = f.queue || []; f.queue = [];
  for (var i = 0; i < q.length; i++) handle(q[i]);
  if (!f.disablePushState) {
    var ps = history.pushState; history.pushState = function () { ps.apply(this, arguments); send("PageView", "history"); };
    var rs = history.replaceState; history.replaceState = function () { rs.apply(this, arguments); send("PageView", "history"); };
    window.addEventListener("popstate", function () { send("PageView", "history"); });
  }
  document.addEventListener("click", function (e) { if (auto && e.target.closest("a,button")) send("SubscribedButtonClick", "auto"); }, true);
})();`;

/* ------------------------------------------------------------------ */
/* Checks                                                               */
/* ------------------------------------------------------------------ */

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"} ${name}${ok || !detail ? "" : ` (${detail})`}`);

async function trackers(chromium) {
  const events = [];
  const scripts = [];
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-proxy-server"] });
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      localStorage.setItem("jvb.consent.v1", JSON.stringify({ v: 1, ts: new Date().toISOString(), analytics: "granted", marketing: "granted" }));
    });
    await ctx.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return route.continue();
      if (u.hostname === "analytics.joostvandenbergh.com" && u.pathname.startsWith("/js/")) {
        scripts.push(u.pathname);
        return route.fulfill({ contentType: "text/javascript", body: FAKE_PLAUSIBLE(u.pathname.includes(".manual")) });
      }
      if (u.hostname === "analytics.joostvandenbergh.com" && u.pathname === "/api/event") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        events.push({ to: "plausible", url: body.u, referrer: body.r ?? "" });
        return route.fulfill({ status: 202, body: "ok" });
      }
      if (u.hostname === "connect.facebook.net") {
        scripts.push(u.pathname);
        return route.fulfill({ contentType: "text/javascript", body: FAKE_FBEVENTS });
      }
      if (u.hostname === "www.facebook.com" && u.pathname === "/tr/") {
        events.push({ to: "meta", ev: u.searchParams.get("ev"), how: u.searchParams.get("how"), url: u.searchParams.get("dl"), referrer: u.searchParams.get("rl") ?? "" });
        return route.fulfill({ status: 204, body: "" });
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    const settle = () => page.waitForTimeout(1500);
    const at = (e) => new URL(e.url).pathname;
    const isPrivate = (s) => /\/(o|newsletter)(\/|$)/.test(s);

    // Landing on a private page, as from the confirmation email.
    const res = await page.goto(`${base}/newsletter/confirmed`, { waitUntil: "networkidle", timeout: 300_000 });
    await settle();
    check("no tracker loads on a private page", scripts.length === 0, scripts.join(", "));
    check("private page is served with Referrer-Policy: strict-origin", res?.headers()["referrer-policy"] === "strict-origin", res?.headers()["referrer-policy"]);
    const meta = await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.getAttribute("content") ?? null);
    check("private page's metadata says strict-origin too", meta === "strict-origin", String(meta));
    for (const [label, p] of [["/o/<token>", `/o/${"a".repeat(36)}`], ["/newsletter/confirm/<token>", `/newsletter/confirm/${"0".repeat(48)}`]]) {
      const r = await ctx.request.get(`${base}${p}`, { maxRedirects: 0 });
      check(`${label} is served with Referrer-Policy: strict-origin`, r.headers()["referrer-policy"] === "strict-origin", r.headers()["referrer-policy"]);
    }
    const pub = await ctx.request.get(`${base}/about`);
    check("public pages keep strict-origin-when-cross-origin", pub.headers()["referrer-policy"] === "strict-origin-when-cross-origin", pub.headers()["referrer-policy"]);

    // An in-page link to a public page: the trackers load there.
    await page.click('header a[href="/"]');
    await page.waitForURL(`${base}/`);
    await settle();
    check("Plausible is the manual tracker", scripts.includes("/js/script.manual.js") && !scripts.includes("/js/script.js"), scripts.join(", "));
    check("Meta's script loads on the public page", scripts.includes("/en_US/fbevents.js"), scripts.join(", "));
    const home = events.filter((e) => at(e) === "/");
    check("one Plausible page view and one Meta PageView for /", home.length === 2 && home.some((e) => e.to === "plausible") && home.some((e) => e.ev === "PageView"), JSON.stringify(home));

    // Back to the private page in the same document, a click there, then Forward.
    const before = events.length;
    await page.goBack();
    await page.waitForURL(`${base}/newsletter/confirmed`);
    await settle();
    await page.click("h1");
    await settle();
    check("Back to the private page sends nothing", events.length === before, JSON.stringify(events.slice(before)));
    await page.goForward();
    await page.waitForURL(`${base}/`);
    await settle();
    const fwd = events.slice(before);
    check("Forward to / is counted again, and nothing else", fwd.length === 2 && fwd.every((e) => at(e) === "/"), JSON.stringify(fwd));

    // A full page load away from a private page: the next page learns only the origin.
    await page.goto(`${base}/newsletter/confirm/${"0".repeat(48)}`, { waitUntil: "networkidle", timeout: 300_000 });
    await settle();
    const n4 = events.length;
    await page.click('footer a[href="/privacy"] >> nth=0');
    await page.waitForURL(`${base}/privacy`);
    await page.waitForLoadState("networkidle");
    await settle();
    const ref = await page.evaluate(() => document.referrer);
    check("the next page's referrer is the site's address only", ref === `${base}/`, ref);
    const p4 = events.slice(n4);
    check("that page is counted, with the origin as referrer", p4.length === 2 && p4.every((e) => at(e) === "/privacy" && !isPrivate(new URL(e.referrer || base).pathname)), JSON.stringify(p4));

    // Ordinary browsing between public pages still counts every page.
    const n5 = events.length;
    await page.click('footer a[href="/terms"] >> nth=0');
    await page.waitForURL(`${base}/terms`);
    await settle();
    const p5 = events.slice(n5);
    check("in-page navigation between public pages is counted", p5.length === 2 && p5.every((e) => at(e) === "/terms"), JSON.stringify(p5));

    // Withdrawing consent stops further page views at once.
    await page.evaluate(() => {
      localStorage.removeItem("jvb.consent.v1");
      window.dispatchEvent(new CustomEvent("jvb:consent", { detail: null }));
    });
    await settle();
    const n6 = events.length;
    // The cookie banner is back over the footer: follow the link from script.
    await page.evaluate(() => document.querySelector('footer a[href="/cookies"]').click());
    await page.waitForURL(`${base}/cookies`);
    await settle();
    check("no page views once consent is withdrawn", events.length === n6, JSON.stringify(events.slice(n6)));

    const leaks = events.filter((e) => isPrivate(at(e)) || isPrivate(e.referrer ? new URL(e.referrer).pathname : ""));
    check("no event anywhere carried a private address", leaks.length === 0, JSON.stringify(leaks));
  } finally {
    await browser.close();
  }
}

async function forms() {
  const post = async (p, body) => {
    const r = await fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const enquiry = (over) => ({ kind: "work", subject: "HARA Satoshi, Bowl | JVB-1", name: "Jane Smith", email: "jane@example.com", message: "Hello", consent: true, ...over });
  const address = { line1: "10 Duke St\tFlat 2", city: "London", postcode: "SW1Y 6BN", country: "UK" };
  const cases = [
    ["enquiry: plain", "/api/enquiry", enquiry({}), 500],
    ["enquiry: CR in a name refused", "/api/enquiry", enquiry({ name: "Jane\rSmith" }), 400],
    ["enquiry: LF in a phone number refused", "/api/enquiry", enquiry({ phone: "0207\n=1+1" }), 400],
    ["enquiry: pasted tab in an address accepted", "/api/enquiry", enquiry({ address }), 500],
    ["enquiry: line separator in a name accepted", "/api/enquiry", enquiry({ name: "Jane Smith" }), 500],
    ["enquiry: line break in the site-built subject accepted", "/api/enquiry", enquiry({ subject: "HARA Satoshi, Bowl\nwith lid | JVB-1" }), 500],
    ["enquiry: line break in the work's key accepted", "/api/enquiry", enquiry({ work: { source: "catalogue", id: "abc\r\ndef" } }), 500],
    ["newsletter: tab in a name accepted", "/api/newsletter", { name: "Jane\tSmith", email: "jane@example.com", consent: true }, 500],
    ["newsletter: LF in a name refused", "/api/newsletter", { name: "Jane\nSmith", email: "jane@example.com", consent: true }, 400],
    ["booking: CR in a name refused", "/api/booking", { appointmentType: "private_viewing", date: "2030-01-02", time: "11:00", name: "A\rB", email: "a@example.com", consent: true }, 400],
  ];
  for (const [name, p, body, want] of cases) {
    const r = await post(p, body);
    check(name, r.status === want, `${r.status} ${r.body.error ?? ""}`);
  }
}

const site = startSite();
try {
  if (!(await waitFor(`${base}/about`, 300_000))) throw new Error(`the website did not start:\n${site.log()}`);
  const { chromium } = await loadPlaywright();
  await trackers(chromium);
  await forms();
} catch (err) {
  check("check run completed", false, String(err?.stack ?? err).split("\n").slice(0, 3).join(" "));
} finally {
  site.child.kill("SIGTERM");
}
console.log(results.join("\n"));
process.exitCode = results.some((r) => r.startsWith("FAIL")) ? 1 : 0;

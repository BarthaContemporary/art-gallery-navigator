/*
 * The browser side shared by shoot.mjs and palette.mjs: playwright-core and
 * Chromium found without installing anything into the repo, a Chromium that
 * cannot reach anything off loopback, and a hand count of requests in flight.
 *
 * playwright-core comes from PLAYWRIGHT_CORE (its package directory) when
 * set, else from a normal import. Chromium is CHROMIUM when set, else the
 * Playwright build in /opt/pw-browsers if present, else Playwright's own.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Loopback (or data:/blob:) URLs; anything unparseable counts as local, as the page's own relative URLs do. */
export const isLocal = (u) => {
  try {
    const url = new URL(u);
    return url.protocol === "data:" || url.protocol === "blob:" || LOCAL.has(url.hostname);
  } catch {
    return true;
  }
};

export async function loadPlaywright() {
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

export function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const known = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return fs.existsSync(known) ? known : undefined;
}

/**
 * Chromium for the preview. Belt and braces with blockOffLocalhost(): every
 * connection Chromium makes off loopback, its own background services
 * included, goes to a proxy that does not exist and fails. --lang makes date
 * inputs read day/month/year, as they do for the gallery.
 */
export async function launchBrowser() {
  const pw = await loadPlaywright();
  const chromium = pw.chromium ?? pw.default?.chromium;
  return chromium.launch({
    executablePath: chromiumPath(),
    args: [
      "--font-render-hinting=none",
      "--lang=en-GB",
      "--proxy-server=http://127.0.0.1:9",
      "--proxy-bypass-list=localhost;127.0.0.1;[::1]",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-pings",
    ],
  });
}

/** Aborts every request of the context that is not to loopback. */
export async function blockOffLocalhost(context) {
  await context.route("**/*", (route) => (isLocal(route.request().url()) ? route.continue() : route.abort("blockedbyclient")));
}

/**
 * Requests in flight, counted by hand: Playwright's networkidle can fire in
 * the gap between hydration and the fetches a panel starts in useEffect,
 * and next dev compiles an API route on its first call, which takes seconds.
 */
export function trackNetwork(page) {
  let inflight = 0;
  let last = Date.now();
  const on = () => {
    inflight++;
    last = Date.now();
  };
  const off = () => {
    inflight = Math.max(0, inflight - 1);
    last = Date.now();
  };
  page.on("request", on);
  page.on("requestfinished", off);
  page.on("requestfailed", off);
  return { quietFor: (ms) => inflight === 0 && Date.now() - last >= ms };
}

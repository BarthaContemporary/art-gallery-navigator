#!/usr/bin/env node
/*
 * Start the preview: the mock Supabase on 127.0.0.1:54321 and the studio
 * under `next dev` on port 3011, both detached so they outlive this shell.
 * Idempotent: a server already started by this script and still answering
 * is left alone. Waits until both answer, then says how to stop them.
 *
 * The studio gets a deliberately small environment: the mock's URL and dummy
 * keys, and nothing else from this shell, so Resend, Sanity, CalDAV,
 * Plausible, the shared drive and the AI keys are all unset and their panels
 * show their "not configured" states. It refuses to start if the studio has
 * a .env file next.js would load, since that could point it at live services.
 *
 * Usage: node scripts/studio-preview/start.mjs [--port 3011] [--mock-port 54321]
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ANON_KEY, SERVICE_KEY } from "./lib/session.mjs";
import { RUN_DIR, readPid, alive, ownedBy } from "./lib/procs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const STUDIO = path.join(ROOT, "apps/studio");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const PORT = Number(arg("--port", process.env.PREVIEW_STUDIO_PORT ?? 3011));
const MOCK_PORT = Number(arg("--mock-port", process.env.PREVIEW_MOCK_PORT ?? 54321));
const STUDIO_URL = `http://localhost:${PORT}`;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

fs.mkdirSync(RUN_DIR, { recursive: true });

for (const f of [".env", ".env.local", ".env.development", ".env.development.local"]) {
  if (fs.existsSync(path.join(STUDIO, f))) {
    console.error(`apps/studio/${f} exists. next dev would load it, and it may hold live credentials.`);
    console.error("Move it aside while previewing; the preview must never reach the live services.");
    process.exit(1);
  }
}

async function answers(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

/** Only what node and next need to run; no secrets from the calling shell. */
function baseEnv() {
  const keep = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR", "TEMP", "TMP", "SHELL", "TERM", "NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "SystemRoot"];
  const env = {};
  for (const k of keep) if (process.env[k] != null) env[k] = process.env[k];
  return env;
}

function launch(name, command, args, { cwd, env, check }) {
  const pidFile = path.join(RUN_DIR, `${name}.pid`);
  const logFile = path.join(RUN_DIR, `${name}.log`);
  const out = fs.openSync(logFile, "a");
  fs.appendFileSync(logFile, `\n--- ${new Date().toISOString()} starting ${command} ${args.join(" ")}\n`);
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ["ignore", out, out] });
  child.unref();
  fs.writeFileSync(pidFile, JSON.stringify({ pid: child.pid, marker: check, started: new Date().toISOString(), log: logFile }));
  return { pid: child.pid, logFile };
}

async function ensure(name, url, start) {
  const info = readPid(name);
  if (info && alive(info.pid) && ownedBy(info) && (await answers(url))) {
    console.log(`${name}: already running (pid ${info.pid}) at ${url}`);
    return info;
  }
  if (await answers(url)) {
    console.error(`${name}: something else is already answering at ${url}. Stop it, or pass another port.`);
    process.exit(1);
  }
  const started = start();
  console.log(`${name}: started (pid ${started.pid}), log ${path.relative(process.cwd(), started.logFile)}`);
  return started;
}

async function waitFor(name, url, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
      if (res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`${name}: no answer from ${url} after ${Math.round(timeoutMs / 1000)} s; see its log in ${path.relative(process.cwd(), RUN_DIR)}.`);
  return false;
}

const mock = await ensure("mock", `${MOCK_URL}/__preview/health`, () =>
  launch("mock", process.execPath, [path.join(HERE, "mock-supabase.mjs"), "--port", String(MOCK_PORT)], {
    cwd: HERE,
    env: { ...baseEnv(), PREVIEW_STUDIO_ORIGIN: STUDIO_URL, PREVIEW_RUN_DIR: RUN_DIR },
    check: "mock-supabase.mjs",
  }),
);
if (!(await waitFor("mock", `${MOCK_URL}/__preview/health`, 20_000))) process.exit(1);

const nextBin = path.join(STUDIO, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const studio = await ensure("studio", `${STUDIO_URL}/login`, () =>
  launch("studio", nextBin, ["dev", "-p", String(PORT)], {
    cwd: STUDIO,
    env: {
      ...baseEnv(),
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: MOCK_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      // Links the studio builds for itself (invites, offers) stay local.
      NEXT_PUBLIC_SITE_URL: "http://localhost:3999",
      OFFER_LINK_BASE_URL: "http://localhost:3999",
    },
    check: "next",
  }),
);
// The first request compiles the sign-in page; next dev can take a while.
if (!(await waitFor("studio", `${STUDIO_URL}/login`, 240_000))) process.exit(1);

console.log(`
Preview ready (fictional data, never the live database):
  studio  ${STUDIO_URL}   pid ${studio.pid}
  mock    ${MOCK_URL}   pid ${mock.pid}
Shoot:  node scripts/studio-preview/shoot.mjs --out <dir>
Stop:   node scripts/studio-preview/stop.mjs
Unanswered requests: ${path.relative(process.cwd(), path.join(RUN_DIR, "unanswered.log"))}`);

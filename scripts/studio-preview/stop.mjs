#!/usr/bin/env node
/*
 * Stop the servers start.mjs started (and only those): reads .run/*.pid,
 * checks each pid still runs the command it was started with, and sends
 * SIGTERM to its process group (next dev runs workers under it).
 *
 * Usage: node scripts/studio-preview/stop.mjs
 */

import { readPid, alive, ownedBy, clearPid } from "./lib/procs.mjs";

for (const name of ["studio", "mock"]) {
  const info = readPid(name);
  if (!info) {
    console.log(`${name}: not started by start.mjs`);
    continue;
  }
  if (!alive(info.pid) || !ownedBy(info)) {
    console.log(`${name}: pid ${info.pid} is no longer ours; clearing the pid file`);
    clearPid(name);
    continue;
  }
  try {
    // Detached children lead their own group; the minus sign signals all of it.
    process.kill(-info.pid, "SIGTERM");
  } catch {
    process.kill(info.pid, "SIGTERM");
  }
  const t0 = Date.now();
  while (alive(info.pid) && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 200));
  if (alive(info.pid)) {
    try {
      process.kill(-info.pid, "SIGKILL");
    } catch {}
  }
  clearPid(name);
  console.log(`${name}: stopped (pid ${info.pid})`);
}

/*
 * Pid files for the servers start.mjs launches, so stop.mjs stops exactly
 * those and nothing else.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RUN_DIR = process.env.PREVIEW_RUN_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".run");

export function readPid(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(RUN_DIR, `${name}.pid`), "utf8"));
  } catch {
    return null;
  }
}

export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the pid still belongs to what we started (pids are reused). On
 * Linux the command line is checked for the marker; elsewhere a live pid is
 * taken at its word.
 */
export function ownedBy(info) {
  const cmdline = `/proc/${info.pid}/cmdline`;
  if (!fs.existsSync("/proc")) return true;
  try {
    return fs.readFileSync(cmdline, "utf8").includes(info.marker);
  } catch {
    return false;
  }
}

export function clearPid(name) {
  fs.rmSync(path.join(RUN_DIR, `${name}.pid`), { force: true });
}

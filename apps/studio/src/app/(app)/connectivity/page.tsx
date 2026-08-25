"use client";

import { useState } from "react";

/**
 * Connectivity self-test — open this page ON THE MACHINE THAT HAS TROUBLE.
 *
 * The studio's pages come from Vercel, but the drive and every file upload go
 * straight from the browser to the gallery's own server, so "the studio works
 * but uploads/drive don't" almost always means THIS network cannot reach that
 * server. These tests run from the browser of whoever opens the page and time
 * each leg separately, so one screenshot (or the copied report) says exactly
 * which hop fails — and running it twice, once on the normal network and once
 * on a phone hotspot, says whose network is at fault.
 */

const API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const DRIVE = "https://drive.joostvandenbergh.com";

type Result = {
  name: string;
  detail: string;
  state: "pending" | "running" | "ok" | "fail";
  ms?: number;
  note?: string;
};

const INITIAL: Result[] = [
  { name: "Studio (Vercel)", detail: "This page loaded, so this leg works.", state: "ok" },
  { name: "Gallery server — API", detail: `${API}/auth/v1/health`, state: "pending" },
  { name: "Gallery server — small upload (64 KB)", detail: "signed upload, direct to storage", state: "pending" },
  { name: "Gallery server — larger upload (4 MB)", detail: "same route, real-file sized", state: "pending" },
  { name: "Drive — reachability", detail: DRIVE, state: "pending" },
];

export default function ConnectivityPage() {
  const [results, setResults] = useState<Result[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = (i: number, patch: Partial<Result>) =>
    setResults((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  async function timed(fn: () => Promise<void>): Promise<{ ok: boolean; ms: number; note?: string }> {
    const t0 = performance.now();
    try {
      await fn();
      return { ok: true, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return {
        ok: false,
        ms: Math.round(performance.now() - t0),
        note: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async function signProbe(): Promise<{ path: string; signedUrl: string }> {
    const res = await fetch("/api/connectivity/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign" }),
    });
    if (!res.ok) throw new Error(`could not prepare the test upload (${res.status})`);
    return (await res.json()) as { path: string; signedUrl: string };
  }

  async function putBytes(signedUrl: string, bytes: number): Promise<void> {
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
  }

  async function run() {
    setRunning(true);
    setDone(false);
    setResults(INITIAL);
    const cleanup: string[] = [];

    // 1. API health — a tiny GET straight to the gallery server. The gateway
    // wants an api key; but for CONNECTIVITY any HTTP answer at all proves the
    // server was reached — only a network-level failure (no response) fails.
    update(1, { state: "running" });
    const api = await timed(async () => {
      const res = await fetch(`${API}/auth/v1/health`, {
        cache: "no-store",
        headers: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
          : undefined,
      });
      if (!res.ok) throw new Error(`reachable — server answered ${res.status}`);
    });
    update(1, {
      // A thrown fetch = no response = genuinely unreachable. An HTTP status,
      // even an unhappy one, means the wire works.
      state: api.ok || api.note?.startsWith("reachable") ? "ok" : "fail",
      ms: api.ms,
      note: api.note,
    });

    // 2 + 3. Uploads — the exact path shipment/document files take.
    for (const [idx, size] of [
      [2, 64 * 1024],
      [3, 4 * 1024 * 1024],
    ] as const) {
      update(idx, { state: "running" });
      const r = await timed(async () => {
        const { path, signedUrl } = await signProbe();
        cleanup.push(path);
        await putBytes(signedUrl, size);
      });
      update(idx, { state: r.ok ? "ok" : "fail", ms: r.ms, note: r.note });
    }

    // 4. Drive host — no login from a browser, but "can this network reach it
    // at all" is answerable: an opaque no-cors fetch resolves iff DNS + TCP +
    // TLS all worked.
    update(4, { state: "running" });
    const drive = await timed(async () => {
      await fetch(`${DRIVE}/`, { mode: "no-cors", cache: "no-store" });
    });
    update(4, {
      state: drive.ok ? "ok" : "fail",
      ms: drive.ms,
      note: drive.ok ? "reachable (log in via Finder as usual)" : drive.note,
    });

    // Remove the probe objects; best-effort.
    if (cleanup.length > 0) {
      void fetch("/api/connectivity/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", paths: cleanup }),
      }).catch(() => {});
    }

    setRunning(false);
    setDone(true);
  }

  function report(): string {
    const lines = results.map(
      (r) =>
        `${r.state === "ok" ? "OK  " : r.state === "fail" ? "FAIL" : "—   "} ${r.name}` +
        (r.ms != null ? ` (${r.ms} ms)` : "") +
        (r.note ? ` — ${r.note}` : ""),
    );
    return [
      `Connectivity report — ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      ...lines,
    ].join("\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(report());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the textarea below stays selectable by hand */
    }
  }

  const dot = (s: Result["state"]) =>
    s === "ok" ? "bg-status-green" : s === "fail" ? "bg-danger" : s === "running" ? "bg-warn" : "bg-line-control";

  return (
    <div className="max-w-[720px]">
      <h1 className="text-[24px] font-semibold text-ink-strong">Connection test</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Run this on the computer that is having trouble. It tests each connection this
        computer needs, from here. If something fails, run it again on a different
        network (e.g. an iPhone hotspot) and compare — that tells us whose network is
        at fault.
      </p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={running}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-fg disabled:opacity-60"
      >
        {running ? "Testing…" : done ? "Run again" : "Run the test"}
      </button>

      <ul className="mt-5 space-y-2">
        {results.map((r) => (
          <li
            key={r.name}
            className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line-soft bg-cell px-3.5 py-2.5"
          >
            <span aria-hidden className={`h-[9px] w-[9px] shrink-0 rounded-full ${dot(r.state)}`} />
            <span className="text-[13.5px] font-medium text-ink-body">{r.name}</span>
            {r.ms != null ? (
              <span className="font-mono text-[11.5px] text-ink-soft">{r.ms} ms</span>
            ) : null}
            <span className="w-full pl-5 text-[12px] text-ink-soft sm:w-auto sm:flex-1 sm:pl-0">
              {r.note ?? r.detail}
            </span>
          </li>
        ))}
      </ul>

      {done ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-medium text-ink-mid"
          >
            {copied ? "Copied ✓" : "Copy report"}
          </button>
          <textarea
            readOnly
            value={report()}
            rows={8}
            className="mt-2 w-full rounded-lg border border-line-control bg-control p-3 font-mono text-[11.5px] text-ink-body"
          />
          <p className="mt-1.5 text-[12px] text-ink-soft">
            Send the report (or a screenshot) to the office — and say which network you
            were on when you ran it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

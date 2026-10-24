#!/usr/bin/env node
/*
 * A stand-in Supabase for previewing the studio with fictional data.
 *
 * Answers the three services the studio talks to, on one port:
 *   /auth/v1/*     GoTrue: the signed-in user, token refresh, admin user list
 *   /rest/v1/*     PostgREST over fixtures/data/*.json (lib/postgrest.mjs)
 *   /storage/v1/*  signed URLs that point back here, and placeholder images
 * plus /__preview/* for health, a fixture reload and the unanswered log.
 *
 * It never talks to the live database. Requests it cannot answer are logged
 * (method, path, query, reason) to .run/unanswered.log and get an empty
 * result, so a missing fixture shows up as a line there rather than a crash.
 *
 * Usage: node scripts/studio-preview/mock-supabase.mjs [--port 54321]
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Db } from "./lib/db.mjs";
import { parseQuery, runRead, projectRows, matcher, toCsv } from "./lib/postgrest.mjs";
import { RPC } from "./lib/rpc.mjs";
import { drawPlaceholder, placeholderPdf } from "./lib/images.mjs";
import { USERS, OTHER_USERS, authUser, sessionFor, userForToken } from "./lib/session.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUN_DIR = process.env.PREVIEW_RUN_DIR ?? path.join(HERE, ".run");
const DATA_DIR = process.env.PREVIEW_FIXTURES ?? path.join(HERE, "fixtures", "data");
const argPort = process.argv.indexOf("--port");
const PORT = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PREVIEW_MOCK_PORT ?? 54321);
const HOST = "127.0.0.1";
const STUDIO_ORIGIN = process.env.PREVIEW_STUDIO_ORIGIN ?? "http://localhost:3011";

fs.mkdirSync(RUN_DIR, { recursive: true });
const UNANSWERED_LOG = path.join(RUN_DIR, "unanswered.log");

const db = new Db(DATA_DIR);
const uploads = new Map(); // "bucket/path" → { body, type }
const imageCache = new Map();

// ------------------------------------------------------------- unanswered

const seen = new Map();
function logUnanswered(req, url, reason) {
  const key = `${req.method} ${url.pathname} ${reason}`;
  const entry = seen.get(key);
  if (entry) {
    entry.count++;
    return;
  }
  const line = {
    time: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    query: url.search,
    reason,
  };
  seen.set(key, { ...line, count: 1 });
  fs.appendFileSync(UNANSWERED_LOG, `${JSON.stringify(line)}\n`);
}

// ----------------------------------------------------------------- helpers

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info,prefer,range,range-unit,accept,accept-profile,content-profile,x-upsert,x-retry-count,cache-control,x-supabase-api-version",
  "Access-Control-Expose-Headers": "content-range,x-total-count,link,content-location,range-unit",
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = body === undefined || body === null ? "" : isBuf || typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    ...(isBuf || typeof body === "string" ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    ...headers,
  });
  res.end(res.req.method === "HEAD" ? undefined : payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function jsonBody(buf) {
  if (!buf.length) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

function bearer(req) {
  const h = req.headers.authorization ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : req.headers.apikey ?? "";
}

function contextFor(req, url) {
  const who = userForToken(bearer(req)) ?? { role: "anon" };
  return {
    role: who.role,
    userId: who.user?.id ?? null,
    cache: new Map(),
    miss: (reason) => logUnanswered(req, url, reason),
  };
}

function prefer(req) {
  const out = {};
  for (const part of String(req.headers.prefer ?? "").split(",")) {
    const [k, v] = part.trim().split("=");
    if (k) out[k] = v ?? true;
  }
  return out;
}

function parseRange(req) {
  const r = req.headers.range;
  if (!r) return null;
  const m = String(r).match(/(\d+)-(\d*)/);
  return m ? { from: Number(m[1]), to: m[2] ? Number(m[2]) : null } : null;
}

const wantsObject = (req) => String(req.headers.accept ?? "").includes("vnd.pgrst.object+json");
const wantsCsv = (req) => String(req.headers.accept ?? "").includes("text/csv");

function contentRange(offset, n, count) {
  const total = count == null ? "*" : String(count);
  return n > 0 ? `${offset}-${offset + n - 1}/${total}` : `*/${total}`;
}

function notSingle(res, n) {
  return send(res, 406, {
    code: "PGRST116",
    details: `The result contains ${n} rows`,
    hint: null,
    message: "JSON object requested, multiple (or no) rows returned",
  });
}

/** Respond with rows the way PostgREST would for this request's headers. */
function respondRows(req, res, rows, { count, offset = 0, status = 200 }) {
  const p = prefer(req);
  const headers = { "Content-Range": contentRange(offset, rows.length, p.count ? count : null) };
  if (wantsObject(req)) {
    if (rows.length !== 1) return notSingle(res, rows.length);
    return send(res, status, rows[0], headers);
  }
  if (wantsCsv(req)) return send(res, status, toCsv(rows), { ...headers, "Content-Type": "text/csv; charset=utf-8" });
  return send(res, status, rows, headers);
}

// -------------------------------------------------------------------- auth

function userFromRequest(req) {
  const who = userForToken(bearer(req));
  return who?.user ?? null;
}

function allAuthUsers() {
  return [...Object.values(USERS), ...OTHER_USERS].map(authUser);
}

async function handleAuth(req, res, url) {
  const p = url.pathname.replace(/^\/auth\/v1/, "");
  const body = jsonBody(await readBody(req)) ?? {};

  if (p === "/user" && (req.method === "GET" || req.method === "PUT")) {
    const u = userFromRequest(req);
    if (!u) return send(res, 401, { code: 401, error_code: "no_authorization", msg: "This endpoint requires a valid Bearer token" });
    return send(res, 200, authUser(u));
  }
  if (p === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      const role = String(body.refresh_token ?? "").replace("preview-refresh-", "");
      if (!USERS[role]) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
      return send(res, 200, sessionFor(role));
    }
    if (grant === "password") {
      const u = Object.entries(USERS).find(([, x]) => x.email === String(body.email ?? "").toLowerCase());
      if (!u) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(res, 200, sessionFor(u[0]));
    }
  }
  if (p === "/logout") return send(res, 204, null);
  if (p === "/health") return send(res, 200, { version: "studio-preview", name: "GoTrue", description: "Mock auth for the studio preview" });
  if (p === "/settings") return send(res, 200, { external: { email: true }, disable_signup: true, mailer_autoconfirm: false });
  if (p === "/recover" || p === "/otp") return send(res, 200, {});

  if (p.startsWith("/admin/")) {
    if (contextFor(req, url).role !== "service") return send(res, 403, { msg: "User not allowed" });
    if (p === "/admin/users" && req.method === "GET") {
      const users = allAuthUsers();
      return send(res, 200, { users, aud: "authenticated" }, { "x-total-count": String(users.length) });
    }
    if (p === "/admin/users" && req.method === "POST") {
      const u = { ...authUser({ id: crypto.randomUUID(), email: body.email, full_name: "" }) };
      return send(res, 200, u);
    }
    const one = p.match(/^\/admin\/users\/([\w-]+)$/);
    if (one) {
      const u = allAuthUsers().find((x) => x.id === one[1]) ?? authUser({ id: one[1], email: "unknown@example.com", full_name: "" });
      return send(res, 200, u);
    }
    if (p === "/admin/generate_link") {
      const target = allAuthUsers().find((x) => x.email === body.email) ?? authUser({ id: crypto.randomUUID(), email: body.email, full_name: "" });
      return send(res, 200, {
        ...target,
        action_link: `${STUDIO_ORIGIN}/set-password#access_token=preview&type=recovery`,
        email_otp: "000000",
        hashed_token: "preview",
        redirect_to: body.redirect_to ?? `${STUDIO_ORIGIN}/set-password`,
        verification_type: body.type ?? "recovery",
      });
    }
  }
  logUnanswered(req, url, "auth endpoint not emulated");
  return send(res, 200, {});
}

// -------------------------------------------------------------------- rest

async function handleRest(req, res, url) {
  const ctx = contextFor(req, url);
  const name = decodeURIComponent(url.pathname.replace(/^\/rest\/v1\/?/, ""));
  if (name === "") return send(res, 200, { swagger: "2.0", info: { title: "studio-preview" } });

  const rpc = name.match(/^rpc\/(\w+)$/);
  if (rpc) return handleRpc(req, res, url, ctx, rpc[1]);

  const query = parseQuery(url.searchParams);
  const select = url.searchParams.get("select") ?? "*";
  const p = prefer(req);

  if (req.method === "GET" || req.method === "HEAD") {
    const rows = db.rows(name, ctx);
    if (rows === null) {
      ctx.miss(`no fixture for table or view "${name}"`);
      return respondRows(req, res, [], { count: 0 });
    }
    const out = runRead(db, name, rows, { select, query, range: parseRange(req) }, ctx);
    return respondRows(req, res, out.rows, { count: out.count, offset: out.offset });
  }

  if (!db.tables.has(name)) ctx.miss(`write to "${name}", which has no fixture (created empty)`);
  const raw = await readBody(req);

  if (req.method === "POST") {
    let input = jsonBody(raw);
    if (input == null) return send(res, 400, { message: "Empty or invalid json" });
    const list = Array.isArray(input) ? input : [input];
    const columns = url.searchParams.get("columns");
    const rowsIn = columns
      ? list.map((r) => Object.fromEntries(columns.split(",").map((c) => [c.replace(/"/g, ""), r[c.replace(/"/g, "")]])))
      : list;
    const resolution = p.resolution === "merge-duplicates" ? "merge" : p.resolution === "ignore-duplicates" ? "ignore" : null;
    const written = db.insert(name, rowsIn, { onConflict: url.searchParams.get("on_conflict"), resolution }, ctx);
    if (p.return === "representation") {
      return respondRows(req, res, projectRows(db, name, written, select, ctx), { count: written.length, status: 201 });
    }
    return send(res, 201, null, { "Content-Range": `*/${p.count ? written.length : "*"}` });
  }

  if (req.method === "PATCH") {
    const patch = jsonBody(raw) ?? {};
    const written = db.update(name, matcher(query, ctx), patch);
    if (p.return === "representation") return respondRows(req, res, projectRows(db, name, written, select, ctx), { count: written.length });
    return send(res, 204, null, { "Content-Range": `0-${Math.max(written.length - 1, 0)}/${p.count ? written.length : "*"}` });
  }

  if (req.method === "DELETE") {
    const gone = db.delete(name, matcher(query, ctx));
    if (p.return === "representation") return respondRows(req, res, projectRows(db, name, gone, select, ctx), { count: gone.length });
    return send(res, 204, null, { "Content-Range": `*/${p.count ? gone.length : "*"}` });
  }

  ctx.miss(`method ${req.method} on a table`);
  return send(res, 200, []);
}

async function handleRpc(req, res, url, ctx, fn) {
  const raw = req.method === "POST" ? await readBody(req) : Buffer.alloc(0);
  const args = req.method === "POST" ? jsonBody(raw) ?? {} : Object.fromEntries(url.searchParams);
  const impl = RPC[fn];
  if (!impl) {
    ctx.miss(`rpc ${fn} not emulated`);
    return send(res, 200, []);
  }
  const result = impl(db, args, ctx);
  if (result.error) return send(res, 400, { hint: null, details: null, ...result.error });
  if (result.rows) {
    const query = parseQuery(url.searchParams);
    const select = url.searchParams.get("select") ?? "*";
    const out = runRead(db, result.table, result.rows, { select, query, range: parseRange(req) }, ctx);
    return respondRows(req, res, out.rows, { count: out.count, offset: out.offset });
  }
  // A scalar result goes out as JSON, as PostgREST sends it (a bare string
  // would be read as a parse error by supabase-js).
  const json = (v) => (typeof v === "string" ? Buffer.from(JSON.stringify(v)) : v);
  if (wantsObject(req)) return send(res, 200, json(result.value), { "Content-Type": "application/json; charset=utf-8" });
  return send(res, 200, result.value === undefined ? null : json(result.value), { "Content-Type": "application/json; charset=utf-8" });
}

// ----------------------------------------------------------------- storage

const BUCKETS = ["piece-originals", "piece-derivatives", "piece-documents", "maker-portraits", "captures", "kyc-documents", "exports"];

function signToken(bucket, objectPath, transform) {
  return Buffer.from(JSON.stringify({ b: bucket, p: objectPath, t: transform ?? null })).toString("base64url");
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

/** Natural size and scene for an object path, from the fixtures where known. */
function describeObject(bucket, objectPath) {
  const img = db.table("piece_images").find((i) => i.storage_path_display === objectPath || i.storage_path_original === objectPath);
  if (img) {
    const scale = Math.min(1, 1600 / Math.max(img.width ?? 1200, img.height ?? 1200));
    return {
      width: Math.round((img.width ?? 1200) * scale),
      height: Math.round((img.height ?? 1200) * scale),
      scene: img.__scene ?? null,
    };
  }
  if (/\.sq-\d+x\d+\./.test(objectPath)) return { width: 1600, height: 1600, scene: "object" };
  if (bucket === "maker-portraits") return { width: 900, height: 1200, scene: "portrait" };
  if (bucket === "piece-documents") return { width: 1240, height: 1754, scene: "page" };
  return { width: 1200, height: 900, scene: null };
}

function serveObject(req, res, url, bucket, objectPath, transform) {
  const stored = uploads.get(`${bucket}/${objectPath}`);
  if (stored) return send(res, 200, stored.body, { "Content-Type": stored.type, "Cache-Control": "max-age=3600" });
  if (/\.pdf$/i.test(objectPath)) {
    const doc = db.table("piece_documents").find((d) => d.storage_path === objectPath) ?? db.table("shipment_documents").find((d) => d.storage_path === objectPath);
    return send(res, 200, placeholderPdf(doc?.title ?? path.basename(objectPath)), { "Content-Type": "application/pdf" });
  }
  const info = describeObject(bucket, objectPath);
  let w = info.width;
  let h = info.height;
  const tw = Number(transform?.width ?? url.searchParams.get("width") ?? 0);
  const th = Number(transform?.height ?? url.searchParams.get("height") ?? 0);
  if (tw && th) {
    w = tw;
    h = th;
  } else if (tw) {
    h = Math.round((h * Math.min(tw, w)) / w);
    w = Math.min(tw, w);
  } else if (th) {
    w = Math.round((w * Math.min(th, h)) / h);
    h = Math.min(th, h);
  }
  const key = `${bucket}/${objectPath}@${w}x${h}`;
  let png = imageCache.get(key);
  if (!png) {
    png = drawPlaceholder(`${bucket}/${objectPath}`, Math.max(1, w), Math.max(1, h), info.scene ?? undefined);
    if (imageCache.size > 600) imageCache.delete(imageCache.keys().next().value);
    imageCache.set(key, png);
  }
  return send(res, 200, png, { "Content-Type": "image/png", "Cache-Control": "max-age=3600" });
}

async function handleStorage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
  const ctx = contextFor(req, url);

  if (p === "/bucket" && req.method === "GET") return send(res, 200, BUCKETS.map((id) => ({ id, name: id, public: false })));
  const bucketOne = p.match(/^\/bucket\/([\w-]+)$/);
  if (bucketOne) return send(res, 200, { id: bucketOne[1], name: bucketOne[1], public: false });

  // Batch signing: POST /object/sign/<bucket> { expiresIn, paths }
  let m = p.match(/^\/object\/sign\/([\w-]+)$/);
  if (m && req.method === "POST") {
    const body = jsonBody(await readBody(req)) ?? {};
    return send(
      res,
      200,
      (body.paths ?? []).map((objectPath) => ({
        error: null,
        path: objectPath,
        signedURL: `/object/sign/${m[1]}/${encodePath(objectPath)}?token=${signToken(m[1], objectPath)}`,
      })),
    );
  }
  // Single signing: POST /object/sign/<bucket>/<path> { expiresIn, transform? }
  m = p.match(/^\/object\/sign\/([\w-]+)\/(.+)$/);
  if (m && req.method === "POST") {
    const body = jsonBody(await readBody(req)) ?? {};
    const transform = body.transform && Object.keys(body.transform).length ? body.transform : null;
    const base = transform ? "/render/image/sign" : "/object/sign";
    return send(res, 200, { signedURL: `${base}/${m[1]}/${encodePath(m[2])}?token=${signToken(m[1], m[2], transform)}` });
  }
  // Serving a signed URL.
  m = p.match(/^\/(object|render\/image)\/sign\/([\w-]+)\/(.+)$/);
  if (m && (req.method === "GET" || req.method === "HEAD")) {
    let transform = null;
    try {
      transform = JSON.parse(Buffer.from(url.searchParams.get("token") ?? "", "base64url").toString("utf8")).t;
    } catch {}
    return serveObject(req, res, url, m[2], m[3], transform);
  }
  // Authenticated and public reads, downloads and on-the-fly renders.
  m = p.match(/^\/(?:object|render\/image)\/(?:authenticated|public)\/([\w-]+)\/(.+)$/);
  if (m && (req.method === "GET" || req.method === "HEAD")) return serveObject(req, res, url, m[1], m[2], null);

  // Upload URL signing and the upload itself.
  m = p.match(/^\/object\/upload\/sign\/([\w-]+)\/(.+)$/);
  if (m && req.method === "POST") {
    await readBody(req);
    const token = signToken(m[1], m[2]);
    return send(res, 200, { url: `/object/upload/sign/${m[1]}/${encodePath(m[2])}?token=${token}`, token });
  }
  if (m && req.method === "PUT") {
    const body = await readBody(req);
    uploads.set(`${m[1]}/${m[2]}`, { body, type: req.headers["content-type"] ?? "application/octet-stream" });
    return send(res, 200, { Key: `${m[1]}/${m[2]}` });
  }
  m = p.match(/^\/object\/list\/([\w-]+)$/);
  if (m) {
    await readBody(req);
    return send(res, 200, []);
  }
  if (p === "/object/move" || p === "/object/copy") {
    await readBody(req);
    return send(res, 200, { message: "Successfully moved", Key: "" });
  }
  m = p.match(/^\/object\/([\w-]+)$/);
  if (m && req.method === "DELETE") {
    const body = jsonBody(await readBody(req)) ?? {};
    for (const prefix of body.prefixes ?? []) uploads.delete(`${m[1]}/${prefix}`);
    return send(res, 200, (body.prefixes ?? []).map((name) => ({ name, bucket_id: m[1] })));
  }
  m = p.match(/^\/object\/([\w-]+)\/(.+)$/);
  if (m && (req.method === "POST" || req.method === "PUT")) {
    const body = await readBody(req);
    uploads.set(`${m[1]}/${m[2]}`, { body, type: req.headers["content-type"] ?? "application/octet-stream" });
    return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() });
  }
  if (m && (req.method === "GET" || req.method === "HEAD")) return serveObject(req, res, url, m[1], m[2], null);

  ctx.miss("storage endpoint not emulated");
  return send(res, 200, {});
}

// ------------------------------------------------------------------ server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);
    if (url.pathname === "/__preview/health") return send(res, 200, { ok: true, shiftDays: db.shiftDays, anchor: db.meta.anchor_date });
    if (url.pathname === "/__preview/reset" && req.method === "POST") {
      db.load();
      uploads.clear();
      imageCache.clear();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/__preview/unanswered") return send(res, 200, [...seen.values()]);
    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url);
    if (url.pathname.startsWith("/rest/v1")) return await handleRest(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await handleStorage(req, res, url);
    logUnanswered(req, url, "unknown service path");
    return send(res, 200, []);
  } catch (e) {
    logUnanswered(req, url, `mock error: ${e?.message ?? e}`);
    console.error(e);
    return send(res, 500, { message: `studio-preview mock error: ${e?.message ?? e}` });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`studio-preview mock Supabase on http://${HOST}:${PORT} (fixtures ${DATA_DIR}, dates shifted ${db.shiftDays} days)`);
});

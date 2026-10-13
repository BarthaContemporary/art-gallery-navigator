/*
 * A small PostgREST, in memory.
 *
 * Covers what the studio's supabase-js calls send: select with aliases, casts,
 * JSON paths, embedded resources (alias:table!hint(cols), !inner, spreads,
 * rel(count)), the common filters, and/or/not trees, order with nulls
 * placement, limit/offset and Range, exact counts, single-object responses.
 * It aims at realistic rendering rather than completeness: anything it does
 * not understand is reported through `ctx.miss()` so it lands in the
 * unanswered-requests log instead of failing silently.
 */

import { FOREIGN_KEYS } from "./schema.mjs";

// ------------------------------------------------------------------ parsing

/** Split on `sep` at bracket depth 0, outside double quotes. */
export function splitTop(s, sep = ",") {
  const out = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== "\\") quoted = !quoted;
    if (!quoted) {
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") depth--;
      else if (ch === sep && depth === 0) {
        out.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur !== "") out.push(cur);
  return out;
}

/** Strip whitespace outside quotes, as PostgREST does for `select`. */
function compact(s) {
  let out = "";
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && /\s/.test(ch)) continue;
    out += ch;
  }
  return out;
}

/**
 * A column reference with an optional JSON path: `a`, `a->b`, `a->b->>c`.
 * `text` is true when the last hop is `->>` (the value comes back as text).
 */
export function parseColumnRef(ref) {
  const parts = ref.split(/(->>|->)/);
  const name = parts[0];
  const path = [];
  let text = false;
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i + 1].replace(/^'|'$/g, "");
    path.push(/^\d+$/.test(key) ? Number(key) : key);
    text = parts[i] === "->>";
  }
  return { name, path, text };
}

/** Parse a select string into nodes. */
export function parseSelect(raw) {
  const s = compact(raw ?? "*");
  if (!s) return [{ type: "star" }];
  return splitTop(s).map(parseSelectItem);
}

function parseSelectItem(item) {
  if (item === "*") return { type: "star" };
  const embed = item.match(/^(\.\.\.)?(?:([\w$]+):)?([\w$]+)((?:![\w$]+)*)\((.*)\)$/s);
  if (embed) {
    const [, spread, alias, name, bangs, inner] = embed;
    const flags = bangs ? bangs.split("!").filter(Boolean) : [];
    const hint = flags.find((f) => f !== "inner" && f !== "left") ?? null;
    const children = inner === "" ? [{ type: "star" }] : splitTop(inner).map(parseSelectItem);
    // `rel(count)` is the aggregate, not a column called count.
    const isCount = children.length === 1 && children[0].type === "col" && children[0].name === "count" && children[0].path.length === 0;
    if (name === "count" && !alias && inner === "") return { type: "count", alias: "count" };
    return {
      type: "embed",
      name,
      alias: alias ?? name,
      hint,
      inner: flags.includes("inner"),
      spread: Boolean(spread),
      children,
      isCount,
    };
  }
  // alias:column::cast  (alias optional, cast optional)
  const m = item.match(/^(?:([\w$]+):(?!:))?(.+?)(?:::([\w\s]+))?$/);
  const alias = m?.[1] ?? null;
  const ref = parseColumnRef(m?.[2] ?? item);
  const cast = m?.[3] ?? null;
  const outKey = alias ?? (ref.path.length ? String(ref.path[ref.path.length - 1]) : ref.name);
  return { type: "col", ...ref, alias: outKey, cast };
}

// ------------------------------------------------------------------ values

export function getPath(row, ref) {
  let v = row?.[ref.name];
  for (const key of ref.path) {
    if (v == null) return null;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        return null;
      }
    }
    v = v?.[key];
  }
  if (v === undefined) return null;
  if (ref.text && v !== null && typeof v === "object") return JSON.stringify(v);
  if (ref.text && v !== null) return String(v);
  return v;
}

function castValue(v, cast) {
  if (v == null || !cast) return v;
  const c = cast.toLowerCase();
  if (c === "text" || c.startsWith("varchar")) return typeof v === "object" ? JSON.stringify(v) : String(v);
  if (c === "int" || c === "integer" || c === "bigint" || c === "int4" || c === "int8") return Math.trunc(Number(v));
  if (c === "numeric" || c === "float" || c === "float8" || c === "real") return Number(v);
  if (c === "date") return String(v).slice(0, 10);
  return v;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

const collator = new Intl.Collator("en-US");

/** Compare a row value with a filter literal, SQL style; null when unknowable. */
function compare(rowVal, literal) {
  if (rowVal == null || literal == null) return null;
  if (typeof rowVal === "number") {
    const n = Number(literal);
    if (Number.isNaN(n)) return null;
    return rowVal - n;
  }
  if (typeof rowVal === "boolean") {
    const b = literal === true || literal === "true" || literal === "t";
    return (rowVal ? 1 : 0) - (b ? 1 : 0);
  }
  const a = String(rowVal);
  const b = String(literal);
  if (ISO_DATE.test(a) && ISO_DATE.test(b)) {
    const da = Date.parse(a.length === 10 ? `${a}T00:00:00Z` : a);
    const db = Date.parse(b.length === 10 ? `${b}T00:00:00Z` : b);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  }
  return collator.compare(a, b);
}

function likeToRegex(pattern, flags) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, flags);
}

/** `{a,b,"c d"}` or `(a,b)` → ["a","b","c d"] */
function parseList(s) {
  const inner = s.replace(/^[({[]|[)}\]]$/g, "");
  if (inner.trim() === "") return [];
  return splitTop(inner).map((x) => {
    const t = x.trim();
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"');
    return t;
  });
}

function jsonContains(container, contained) {
  if (contained === null || typeof contained !== "object") return container === contained;
  if (Array.isArray(contained)) {
    if (!Array.isArray(container)) return false;
    return contained.every((c) => container.some((x) => jsonContains(x, c)));
  }
  if (container === null || typeof container !== "object") return false;
  return Object.entries(contained).every(([k, v]) => jsonContains(container[k], v));
}

function asArrayOrJson(literal) {
  const t = literal.trim();
  if (t.startsWith("{") && !t.includes(":")) return parseList(t);
  try {
    return JSON.parse(t);
  } catch {
    return parseList(t);
  }
}

/** Evaluate one operator. Returns true/false, or null for SQL unknown. */
function applyOp(op, rowVal, literal) {
  switch (op) {
    case "eq": {
      const c = compare(rowVal, literal);
      return c === null ? null : c === 0;
    }
    case "neq": {
      const c = compare(rowVal, literal);
      return c === null ? null : c !== 0;
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const c = compare(rowVal, literal);
      if (c === null) return null;
      return op === "gt" ? c > 0 : op === "gte" ? c >= 0 : op === "lt" ? c < 0 : c <= 0;
    }
    case "like":
    case "ilike": {
      if (rowVal == null) return null;
      return likeToRegex(literal, op === "ilike" ? "is" : "s").test(String(rowVal));
    }
    case "match":
    case "imatch": {
      if (rowVal == null) return null;
      return new RegExp(literal, op === "imatch" ? "i" : "").test(String(rowVal));
    }
    case "in": {
      if (rowVal == null) return null;
      return parseList(literal).some((v) => compare(rowVal, v) === 0);
    }
    case "is": {
      const l = literal.toLowerCase();
      if (l === "null") return rowVal == null;
      if (l === "not_null") return rowVal != null;
      if (l === "true") return rowVal === true;
      if (l === "false") return rowVal === false;
      if (l === "unknown") return rowVal == null;
      return null;
    }
    case "isdistinct": {
      if (rowVal == null) return literal !== "null";
      return compare(rowVal, literal) !== 0;
    }
    case "cs": {
      if (rowVal == null) return null;
      const want = asArrayOrJson(literal);
      if (Array.isArray(rowVal)) return (Array.isArray(want) ? want : [want]).every((w) => rowVal.some((x) => compare(x, w) === 0 || jsonContains(x, w)));
      return jsonContains(rowVal, want);
    }
    case "cd": {
      if (rowVal == null) return null;
      const outer = asArrayOrJson(literal);
      if (Array.isArray(rowVal)) return rowVal.every((x) => outer.some((o) => compare(x, o) === 0));
      return jsonContains(outer, rowVal);
    }
    case "ov": {
      if (rowVal == null) return null;
      const want = parseList(literal);
      return Array.isArray(rowVal) && rowVal.some((x) => want.some((w) => compare(x, w) === 0));
    }
    case "fts":
    case "plfts":
    case "phfts":
    case "wfts": {
      // No tsvectors here: every word must appear somewhere in the value.
      const hay = (typeof rowVal === "object" ? JSON.stringify(rowVal) : String(rowVal ?? "")).toLowerCase();
      return literal
        .toLowerCase()
        .split(/[\s&|!:*'()]+/)
        .filter(Boolean)
        .every((w) => hay.includes(w));
    }
    default:
      return undefined;
  }
}

/**
 * Parse `[not.]op[(cfg)].value` into a predicate spec. The column may be a
 * JSON path; the value is everything after the operator's dot.
 */
function parseOpValue(spec) {
  let negate = false;
  let s = spec;
  if (s.startsWith("not.")) {
    negate = true;
    s = s.slice(4);
  }
  const m = s.match(/^([a-z]+)(?:\([^)]*\))?\.([\s\S]*)$/);
  if (!m) return null;
  let value = m[2];
  if (value.startsWith('"') && value.endsWith('"') && value.length > 1 && m[1] !== "in") value = value.slice(1, -1);
  return { op: m[1], value, negate };
}

/** `a.eq.1,b.is.null,and(c.gt.2,d.lt.3)` → a logic tree. */
export function parseLogic(kind, inner, negate = false) {
  const body = inner.replace(/^\(|\)$/g, "");
  const terms = splitTop(body).map((t) => parseLogicTerm(t.trim()));
  return { type: "logic", kind, negate, terms };
}

function parseLogicTerm(t) {
  const lm = t.match(/^(not\.)?(and|or)(\(.*\))$/s);
  if (lm) return parseLogic(lm[2], lm[3], Boolean(lm[1]));
  // column . [not.] op . value — the column may contain ->, never a dot.
  const firstDot = t.indexOf(".");
  const column = t.slice(0, firstDot);
  const pred = parseOpValue(t.slice(firstDot + 1));
  return { type: "filter", ref: parseColumnRef(column), ...(pred ?? { op: "invalid", value: "", negate: false }) };
}

function evalNode(node, row, ctx) {
  if (node.type === "filter") {
    const val = getPath(row, node.ref);
    let r = applyOp(node.op, val, node.value);
    if (r === undefined) {
      ctx.miss(`unsupported filter operator "${node.op}" on ${node.ref.name}`);
      return true;
    }
    if (node.negate && r !== null) r = !r;
    return r;
  }
  // and / or with SQL three-valued logic
  let result = node.kind === "and" ? true : false;
  for (const term of node.terms) {
    const r = evalNode(term, row, ctx);
    if (node.kind === "and") {
      if (r === false) {
        result = false;
        break;
      }
      if (r === null) result = null;
    } else {
      if (r === true) {
        result = true;
        break;
      }
      if (r === null && result === false) result = null;
    }
  }
  if (node.negate && result !== null) result = !result;
  return result;
}

// ------------------------------------------------------------- query parts

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

/**
 * Split URL params into the top-level query and per-embed sub-queries
 * (`alias.col=eq.x`, `alias.order=…`, `alias.limit=…`).
 */
export function parseQuery(searchParams) {
  const root = { filters: [], order: null, limit: null, offset: null, children: {} };
  const at = (prefix) => {
    let node = root;
    for (const seg of prefix) {
      node.children[seg] ??= { filters: [], order: null, limit: null, offset: null, children: {} };
      node = node.children[seg];
    }
    return node;
  };
  for (const [key, value] of searchParams) {
    if (key === "select" || key === "on_conflict" || key === "columns") continue;
    // `not.or`, `or`, `and`, possibly prefixed by an embed path.
    const segs = key.split(".");
    const last = segs[segs.length - 1];
    let negateLogic = false;
    let prefix = segs.slice(0, -1);
    if ((last === "or" || last === "and") && segs[segs.length - 2] === "not") {
      negateLogic = true;
      prefix = segs.slice(0, -2);
    }
    if (last === "or" || last === "and") {
      at(prefix).filters.push(parseLogic(last, value, negateLogic));
      continue;
    }
    if (RESERVED.has(last) && (prefix.length > 0 || RESERVED.has(key))) {
      const node = at(prefix);
      if (last === "order") node.order = parseOrder(value);
      else if (last === "limit") node.limit = Number(value);
      else if (last === "offset") node.offset = Number(value);
      continue;
    }
    // A JSON-path column carries `->`; dots before it are embed paths.
    const arrow = key.indexOf("->");
    const head = arrow === -1 ? key : key.slice(0, arrow);
    const tail = arrow === -1 ? "" : key.slice(arrow);
    const parts = head.split(".");
    const column = parts.pop() + tail;
    const pred = parseOpValue(value);
    if (!pred) continue;
    at(parts).filters.push({ type: "filter", ref: parseColumnRef(column), ...pred });
  }
  return root;
}

export function parseOrder(value) {
  return splitTop(value).map((term) => {
    const m = term.match(/^(.+?)(?:\.(asc|desc))?(?:\.(nullsfirst|nullslast))?$/);
    const col = m[1];
    return {
      ref: parseColumnRef(col),
      embedded: col.includes("("),
      desc: m[2] === "desc",
      nulls: m[3] === "nullsfirst" ? "first" : m[3] === "nullslast" ? "last" : null,
    };
  });
}

/**
 * Postgres sorts an enum by its declared order, not alphabetically, and the
 * studio relies on it (the editor orders images by role to find the front
 * shot). Values from supabase/migrations.
 */
const ENUM_ORDER = {
  role: ["front", "back", "side", "signature", "box", "detail", "condition", "document", "other"],
  status: ["in_stock", "reserved", "consigned_in", "consigned_out", "sold", "gifted", "returned", "written_off"],
  vat_treatment: ["margin_scheme", "standard", "zero_rated", "outside_scope"],
  doc_type: ["purchase_invoice", "sale_invoice", "certificate", "export_licence", "condition_report", "provenance_document", "correspondence", "shipping", "insurance", "other", "import_document"],
};

function enumRank(column, value) {
  const list = ENUM_ORDER[column];
  if (!list) return null;
  const i = list.indexOf(value);
  return i === -1 ? null : i;
}

function sortRows(rows, order, ctx) {
  if (!order || order.length === 0) return rows;
  const terms = order.filter((o) => {
    if (o.embedded) ctx.miss(`order by embedded column ${o.ref.name}`);
    return !o.embedded;
  });
  return [...rows].sort((a, b) => {
    for (const o of terms) {
      const av = getPath(a, o.ref);
      const bv = getPath(b, o.ref);
      // PostgreSQL: NULLS LAST for ascending, NULLS FIRST for descending.
      const nullsFirst = o.nulls ? o.nulls === "first" : o.desc;
      if (av == null && bv == null) continue;
      if (av == null) return nullsFirst ? -1 : 1;
      if (bv == null) return nullsFirst ? 1 : -1;
      let c;
      const ar = o.ref.path.length ? null : enumRank(o.ref.name, av);
      const br = o.ref.path.length ? null : enumRank(o.ref.name, bv);
      if (ar !== null && br !== null) c = ar - br;
      else if (typeof av === "number" && typeof bv === "number") c = av - bv;
      else if (typeof av === "boolean" || typeof bv === "boolean") c = Number(av) - Number(bv);
      else c = compare(av, String(bv)) ?? 0;
      if (c !== 0) return o.desc ? -c : c;
    }
    return 0;
  });
}

// --------------------------------------------------------------- embedding

/** Tables that are one identity under PostgREST's eyes: a work. */
const PIECE_FAMILY = new Set(["piece_ref", "pieces", "external_pieces", "vw_pieces_list", "vw_pieces_all"]);
const family = (t) => (PIECE_FAMILY.has(t) ? "piece_ref" : t);
const baseOf = (t) => (t === "vw_pieces_list" || t === "vw_pieces_all" ? "pieces" : t);

/** Work out how `child` hangs off `parent`. */
function relationship(parent, child, hint) {
  const pBase = baseOf(parent);
  const cBase = baseOf(child);
  const pFks = FOREIGN_KEYS[pBase] ?? {};
  const cFks = FOREIGN_KEYS[cBase] ?? {};
  if (hint) {
    for (const col of Object.keys(pFks)) {
      if (hint === col || hint === `${pBase}_${col}_fkey`) return { kind: "m2o", col };
    }
    for (const col of Object.keys(cFks)) {
      if (hint === col || hint === `${cBase}_${col}_fkey`) return { kind: "o2m", col };
    }
  }
  // Embedding by FK column name: `maker_id(display_name)`.
  if (pFks[child]) return { kind: "m2o", col: child, target: pFks[child] };
  const m2o = Object.entries(pFks).filter(([, t]) => family(t) === family(cBase));
  if (m2o.length >= 1) return { kind: "m2o", col: m2o[0][0], ambiguous: m2o.length > 1 };
  const o2m = Object.entries(cFks).filter(([, t]) => family(t) === family(pBase));
  if (o2m.length >= 1) return { kind: "o2m", col: o2m[0][0], ambiguous: o2m.length > 1 };
  return null;
}

/**
 * Raw embedded rows for one parent row: an array (one-to-many) or a row or
 * null (many-to-one), already filtered, ordered and limited by the embed's
 * own sub-query.
 */
function resolveEmbed(db, parentTable, row, node, sub, ctx) {
  const childTable = node.rel?.target ?? node.name;
  const rel = node.rel;
  if (!rel) return node.many ? [] : null;
  let rows;
  if (rel.kind === "m2o") {
    const key = row[rel.col];
    if (key == null) return null;
    rows = db.indexById(childTable, ctx).get(key);
    rows = rows ? [rows] : [];
  } else {
    const parentId = row.id;
    rows = db.rowsByColumn(childTable, rel.col, ctx).get(parentId) ?? [];
  }
  if (sub && sub.filters.length) rows = rows.filter((r) => sub.filters.every((f) => evalNode(f, r, ctx) === true));
  if (rel.kind === "m2o") return rows[0] ?? null;
  if (sub?.order) rows = sortRows(rows, sub.order, ctx);
  if (sub && (sub.offset != null || sub.limit != null)) rows = rows.slice(sub.offset ?? 0, sub.limit != null ? (sub.offset ?? 0) + sub.limit : undefined);
  return rows;
}

/** Attach relationship info to embed nodes, recursively, once per request. */
function bindEmbeds(db, table, nodes, ctx) {
  for (const n of nodes) {
    if (n.type !== "embed") continue;
    const rel = relationship(table, n.name, n.hint);
    if (!rel) {
      ctx.miss(`no relationship between ${table} and ${n.name}${n.hint ? `!${n.hint}` : ""}`);
      n.rel = null;
      n.many = true;
      continue;
    }
    if (rel.ambiguous) ctx.note?.(`ambiguous embed ${table} → ${n.name}; used ${rel.col}`);
    let target = n.name;
    if (rel.kind === "m2o") {
      const fkTarget = FOREIGN_KEYS[baseOf(table)]?.[rel.col] ?? n.name;
      // Named after the table (or a view over it): read that, so a work
      // embedded as vw_pieces_list gets the view's columns. Named after the
      // FK column: read the referenced table.
      target = family(fkTarget) === family(n.name) ? n.name : fkTarget;
    }
    n.rel = { ...rel, target };
    n.many = rel.kind === "o2m";
    if (!db.has(n.rel.target)) {
      ctx.miss(`embedded table ${n.rel.target} has no fixture`);
    }
    bindEmbeds(db, n.rel.target, n.children, ctx);
  }
}

function project(db, table, row, nodes, sub, ctx, cache) {
  const out = {};
  for (const n of nodes) {
    if (n.type === "star") {
      for (const [k, v] of Object.entries(row)) if (!k.startsWith("__")) out[k] = v;
    } else if (n.type === "col") {
      out[n.alias] = castValue(getPath(row, n), n.cast);
    } else if (n.type === "count") {
      out.count = 1;
    } else if (n.type === "embed") {
      const childSub = sub?.children?.[n.alias] ?? sub?.children?.[n.name];
      const raw = cache?.get(n) ?? resolveEmbed(db, table, row, n, childSub, ctx);
      let value;
      if (n.isCount) {
        value = n.many ? [{ count: (raw ?? []).length }] : { count: raw ? 1 : 0 };
      } else if (n.many) {
        value = (raw ?? []).map((r) => project(db, n.rel?.target, r, n.children, childSub, ctx));
      } else {
        value = raw ? project(db, n.rel?.target, raw, n.children, childSub, ctx) : null;
      }
      if (n.spread && value && !Array.isArray(value)) Object.assign(out, value);
      else out[n.alias] = value;
    }
  }
  return out;
}

/**
 * Run a read over `rows` (already the caller-visible rows of `table`).
 * Returns { rows, count } where rows are projected for output.
 */
export function runRead(db, table, rows, { select, query, range }, ctx) {
  const nodes = parseSelect(select);
  bindEmbeds(db, table, nodes, ctx);

  let filtered = rows.filter((r) => query.filters.every((f) => evalNode(f, r, ctx) === true));

  // !inner embeds (and embeds with their own filters marked inner) drop
  // parents whose embedded result came back empty.
  const innerNodes = nodes.filter((n) => n.type === "embed" && n.inner);
  const caches = new Map();
  if (innerNodes.length) {
    filtered = filtered.filter((r) => {
      const cache = new Map();
      for (const n of innerNodes) {
        const sub = query.children[n.alias] ?? query.children[n.name];
        const res = resolveEmbed(db, table, r, n, sub, ctx);
        cache.set(n, res);
        if (res == null || (Array.isArray(res) && res.length === 0)) return false;
      }
      caches.set(r, cache);
      return true;
    });
  }

  filtered = sortRows(filtered, query.order, ctx);
  const count = filtered.length;
  let offset = query.offset ?? 0;
  let limit = query.limit;
  if (range && query.limit == null && query.offset == null) {
    offset = range.from;
    limit = range.to != null ? range.to - range.from + 1 : null;
  }
  const page = filtered.slice(offset, limit != null ? offset + limit : undefined);
  const out = page.map((r) => project(db, table, r, nodes, query, ctx, caches.get(r)));
  return { rows: out, count, offset };
}

/** Project already-written rows for a `return=representation` response. */
export function projectRows(db, table, rows, select, ctx) {
  const nodes = parseSelect(select);
  bindEmbeds(db, table, nodes, ctx);
  return rows.map((r) => project(db, table, r, nodes, { children: {} }, ctx));
}

/** Filter predicate for writes (PATCH/DELETE): every top-level filter holds. */
export function matcher(query, ctx) {
  return (row) => query.filters.every((f) => evalNode(f, row, ctx) === true);
}

/** Rows as CSV, for `.csv()`. */
export function toCsv(rows) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

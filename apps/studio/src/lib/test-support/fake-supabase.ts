/*
 * For unit tests only: a small in-memory stand-in for the supabase-js query
 * builder, enough of it for the studio's list and inventory helpers. Tables
 * are arrays of rows; filters, order, limit, range, counts, inserts,
 * upserts, updates and deletes behave as PostgREST's do for the cases those
 * helpers use (including the 416 a counted request past the end gets).
 * `fail` makes a chosen request answer with an error, and `calls` records
 * every request, so a test can check what was (or was not) written.
 *
 * Never imported by the app.
 */

export type Row = Record<string, unknown>;
export type DbError = { message: string; code?: string };

export type Req = {
  table: string | null;
  rpc: string | null;
  args: Row | null;
  op: "select" | "insert" | "upsert" | "update" | "delete";
  columns: string | null;
  count: boolean;
  head: boolean;
  filters: { kind: string; column: string; value: unknown }[];
  orders: { column: string; ascending: boolean; nullsFirst: boolean }[];
  limit: number | null;
  range: [number, number] | null;
  payload: Row[] | Row | null;
  upsert: { onConflict: string[]; ignoreDuplicates: boolean } | null;
  returning: boolean;
  single: "single" | "maybe" | null;
};

type Result = { data: unknown; error: DbError | null; count: number | null; status: number };

export type FakeOptions = {
  tables?: Record<string, Row[]>;
  /** RPC name → rows it returns for these args, in rank order. */
  rpc?: Record<string, (args: Row) => Row[]>;
  /** Answer this request with an error instead. */
  fail?: (req: Req) => DbError | null | undefined;
};

let nextId = 1;

function matches(row: Row, f: Req["filters"][number]): boolean {
  const v = row[f.column];
  switch (f.kind) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== null && v !== undefined && v !== f.value;
    case "in":
      return (f.value as unknown[]).includes(v);
    case "is":
      return f.value === null ? v === null || v === undefined : v === f.value;
    case "notis":
      return f.value === null ? v !== null && v !== undefined : v !== f.value;
    case "or":
      return String(f.value)
        .split(",")
        .some((part) => {
          const [column = "", op = "", ...rest] = part.split(".");
          const value = rest.join(".");
          const cell = row[column];
          if (op === "is") return value === "null" ? cell === null || cell === undefined : String(cell) === value;
          if (op === "eq") return String(cell) === value;
          if (op === "neq") return cell !== null && cell !== undefined && String(cell) !== value;
          throw new Error(`fake-supabase: unsupported or() operator ${op}`);
        });
    default:
      throw new Error(`fake-supabase: unsupported filter ${f.kind}`);
  }
}

function project(row: Row, columns: string | null): Row {
  if (!columns || columns.trim() === "*") return { ...row };
  const out: Row = {};
  for (const c of columns.split(",").map((s) => s.trim()).filter(Boolean)) out[c] = row[c];
  return out;
}

function sortRows(rows: Row[], orders: Req["orders"]): Row[] {
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const av = a[o.column] ?? null;
      const bv = b[o.column] ?? null;
      if (av === bv) continue;
      if (av === null) return o.nullsFirst ? -1 : 1;
      if (bv === null) return o.nullsFirst ? 1 : -1;
      const cmp = (av as string | number) < (bv as string | number) ? -1 : 1;
      return o.ascending ? cmp : -cmp;
    }
    return 0;
  });
}

export function fakeSupabase(opts: FakeOptions = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(opts.tables ?? {})) tables[name] = rows.map((r) => ({ ...r }));
  const calls: Req[] = [];
  const tableOf = (name: string) => (tables[name] ??= []);

  function execute(req: Req): Result {
    calls.push(req);
    const failed = opts.fail?.(req);
    if (failed) return { data: null, error: failed, count: null, status: 500 };

    if (req.rpc) {
      const fn = opts.rpc?.[req.rpc];
      if (!fn) return { data: null, error: { message: `no rpc ${req.rpc}` }, count: null, status: 404 };
      let rows = fn(req.args ?? {}).filter((r) => req.filters.every((f) => matches(r, f)));
      if (req.limit !== null) rows = rows.slice(0, req.limit);
      return { data: rows.map((r) => project(r, req.columns)), error: null, count: null, status: 200 };
    }

    const rows = tableOf(req.table ?? "");
    if (req.op === "insert" || req.op === "upsert") {
      const incoming = (Array.isArray(req.payload) ? req.payload : [req.payload ?? {}]).map((r) => ({ ...r }));
      const added: Row[] = [];
      for (const r of incoming) {
        const keys = req.upsert?.onConflict ?? [];
        const clash = keys.length ? rows.find((x) => keys.every((k) => x[k] === r[k])) : undefined;
        if (clash) {
          if (req.upsert?.ignoreDuplicates) continue;
          Object.assign(clash, r);
          added.push(clash);
          continue;
        }
        const row = { id: r.id ?? `fake-${nextId++}`, ...r };
        rows.push(row);
        added.push(row);
      }
      return finish(req, added);
    }

    const hit = rows.filter((r) => req.filters.every((f) => matches(r, f)));
    if (req.op === "delete") {
      tables[req.table ?? ""] = rows.filter((r) => !hit.includes(r));
      return finish(req, hit);
    }
    if (req.op === "update") {
      for (const r of hit) Object.assign(r, req.payload);
      return finish(req, hit);
    }

    const total = hit.length;
    let out = sortRows(hit, req.orders);
    if (req.range) {
      const [from, to] = req.range;
      if (req.count && from > total) {
        return {
          data: null,
          error: { code: "PGRST103", message: "Requested range not satisfiable" },
          count: null,
          status: 416,
        };
      }
      out = out.slice(from, to + 1);
    }
    if (req.limit !== null) out = out.slice(0, req.limit);
    const data = req.head ? null : out.map((r) => project(r, req.columns));
    if (req.single) {
      const list = (data ?? []) as Row[];
      if (list.length > 1 || (req.single === "single" && list.length === 0)) {
        return { data: null, error: { code: "PGRST116", message: "not one row" }, count: null, status: 406 };
      }
      return { data: list[0] ?? null, error: null, count: req.count ? total : null, status: 200 };
    }
    return { data, error: null, count: req.count ? total : null, status: 200 };
  }

  function finish(req: Req, rows: Row[]): Result {
    const data = req.returning ? rows.map((r) => project(r, req.columns)) : null;
    if (req.single) {
      return { data: data?.[0] ?? null, error: null, count: null, status: 201 };
    }
    return { data, error: null, count: null, status: 201 };
  }

  function builder(req: Req) {
    const b = {
      select(columns = "*", o: { count?: string; head?: boolean } = {}) {
        if (req.op === "select") req.columns = columns;
        else {
          req.returning = true;
          req.columns = columns;
        }
        req.count = Boolean(o.count);
        req.head = Boolean(o.head);
        return b;
      },
      insert(payload: Row[] | Row) {
        req.op = "insert";
        req.payload = payload;
        return b;
      },
      upsert(payload: Row[] | Row, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
        req.op = "upsert";
        req.payload = payload;
        req.upsert = {
          onConflict: (o.onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          ignoreDuplicates: Boolean(o.ignoreDuplicates),
        };
        return b;
      },
      update(patch: Row) {
        req.op = "update";
        req.payload = patch;
        return b;
      },
      delete() {
        req.op = "delete";
        return b;
      },
      eq(column: string, value: unknown) {
        req.filters.push({ kind: "eq", column, value });
        return b;
      },
      neq(column: string, value: unknown) {
        req.filters.push({ kind: "neq", column, value });
        return b;
      },
      in(column: string, value: unknown[]) {
        req.filters.push({ kind: "in", column, value });
        return b;
      },
      is(column: string, value: unknown) {
        req.filters.push({ kind: "is", column, value });
        return b;
      },
      not(column: string, op: string, value: unknown) {
        if (op !== "is") throw new Error(`fake-supabase: unsupported not(${op})`);
        req.filters.push({ kind: "notis", column, value });
        return b;
      },
      or(filters: string) {
        req.filters.push({ kind: "or", column: "", value: filters });
        return b;
      },
      order(column: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
        const ascending = o.ascending ?? true;
        req.orders.push({ column, ascending, nullsFirst: o.nullsFirst ?? !ascending });
        return b;
      },
      limit(n: number) {
        req.limit = n;
        return b;
      },
      range(from: number, to: number) {
        req.range = [from, to];
        return b;
      },
      single() {
        req.single = "single";
        return b;
      },
      maybeSingle() {
        req.single = "maybe";
        return b;
      },
      then<T1 = Result, T2 = never>(
        onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ): Promise<T1 | T2> {
        return Promise.resolve()
          .then(() => execute(req))
          .then(onfulfilled, onrejected);
      },
    };
    return b;
  }

  const blank = (): Req => ({
    table: null,
    rpc: null,
    args: null,
    op: "select",
    columns: null,
    count: false,
    head: false,
    filters: [],
    orders: [],
    limit: null,
    range: null,
    payload: null,
    upsert: null,
    returning: false,
    single: null,
  });

  const client = {
    from(table: string) {
      return builder({ ...blank(), table });
    },
    rpc(name: string, args: Row = {}) {
      return builder({ ...blank(), rpc: name, args });
    },
  };

  return { client, tables, calls };
}

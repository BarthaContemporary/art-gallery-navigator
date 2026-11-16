// node --test apps/capture/src/lib/push.test.ts
// Runs the capture push against an in-memory stand-in for the Supabase client
// (only the calls lib/push.ts makes), with the database behaviour it relies
// on: stock numbers and financials rows created on insert, one statement at a
// time, and interleaving between concurrent requests at every await.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { attachInvoiceToPiece, foldName, isEmptyWork, LEASE_MINUTES, londonDay, makerPattern, pushBatch } from "./push.ts";

type Row = Record<string, unknown>;
type Pred = (r: Row) => boolean;

/** PostgREST (I)LIKE: % and * any run, _ one character, \ escapes. */
function likeRegex(pattern: string, flags: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "\\" && i + 1 < pattern.length) re += pattern[++i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%" || c === "*") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, flags);
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  objects = new Map<string, Buffer>();
  /** Paths whose next download fails. */
  failDownloadOnce = new Set<string>();
  /** Paths whose download never finishes (the function is cut off there). */
  hang = new Map<string, () => void>();
  /** `${table}:${op}` that fail with an error. */
  failOps = new Set<string>();
  private seq: Record<string, number> = {};

  rows(t: string) {
    return (this.tables[t] ??= []);
  }

  from(table: string) {
    return new Query(this, table);
  }

  storage = {
    from: (bucket: string) => ({
      download: async (path: string) => {
        await tick();
        const key = `${bucket}/${path}`;
        const reached = this.hang.get(key);
        if (reached) {
          reached();
          return new Promise(() => undefined);
        }
        if (this.failDownloadOnce.delete(key)) return { data: null, error: { message: "network" } };
        const buf = this.objects.get(key);
        return buf
          ? { data: { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }, error: null }
          : { data: null, error: { message: "not found" } };
      },
      upload: async (path: string, bytes: Buffer, opts?: { upsert?: boolean }) => {
        await tick();
        const key = `${bucket}/${path}`;
        if (this.objects.has(key) && !opts?.upsert) return { data: null, error: { message: "exists" } };
        this.objects.set(key, Buffer.from(bytes));
        return { data: { path }, error: null };
      },
    }),
  };

  /** What the database does on insert. */
  onInsert(table: string, row: Row): Row {
    const r: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
    if (table === "pieces" || table === "external_pieces") {
      const n = (this.seq[table] = (this.seq[table] ?? 0) + 1);
      r.stock_number = `${table === "pieces" ? "" : "X-"}2026-${String(n).padStart(4, "0")}`;
      this.rows("piece_ref").push({ id: r.id, ledger: table === "pieces" ? "jvb" : "external" });
      this.rows("piece_financials").push({
        piece_id: r.id,
        purchase_date: null,
        purchase_cost: null,
        purchase_currency: "GBP",
        purchase_invoice_document_id: null,
      });
    }
    return r;
  }
}

const tick = () => new Promise<void>((r) => setImmediate(r));

class Query {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: unknown;
  private preds: Pred[] = [];
  private returning = false;
  private countOpt = false;
  private head = false;
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private db: FakeDb;
  private table: string;

  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.countOpt = Boolean(opts?.count);
      this.head = Boolean(opts?.head);
    } else this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.preds.push((r) => r[c] === v);
    return this;
  }
  is(c: string, v: null) {
    this.preds.push((r) => (r[c] ?? null) === v);
    return this;
  }
  lt(c: string, v: string) {
    this.preds.push((r) => r[c] != null && String(r[c]) < v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.preds.push((r) => vs.includes(r[c]));
    return this;
  }
  like(c: string, p: string) {
    const re = likeRegex(p, "");
    this.preds.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  ilike(c: string, p: string) {
    const re = likeRegex(p, "i");
    this.preds.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    this.orders.push({ col, asc: o?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  then<T>(resolve: (v: { data: unknown; error: unknown; count?: number | null }) => T, reject?: (e: unknown) => T) {
    return tick()
      .then(() => this.run())
      .then(resolve, reject);
  }

  private run(): { data: unknown; error: unknown; count?: number | null } {
    if (this.db.failOps.has(`${this.table}:${this.op}`)) return { data: null, error: { message: `${this.op} failed` }, count: null };
    const all = this.db.rows(this.table);
    const match = (r: Row) => this.preds.every((p) => p(r));
    let out: Row[] = [];
    if (this.op === "select") {
      out = all.filter(match);
      for (const o of [...this.orders].reverse()) {
        out.sort((a, b) => {
          const x = String(a[o.col] ?? "");
          const y = String(b[o.col] ?? "");
          return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1);
        });
      }
      if (this.lim !== null) out = out.slice(0, this.lim);
      if (this.head) return { data: null, error: null, count: out.length };
    } else if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      out = rows.map((r) => this.db.onInsert(this.table, r));
      all.push(...out);
      if (!this.returning) return { data: null, error: null };
    } else if (this.op === "update") {
      out = all.filter(match);
      for (const r of out) Object.assign(r, this.payload);
      if (!this.returning) return { data: null, error: null };
    } else {
      out = all.filter(match);
      this.db.tables[this.table] = all.filter((r) => !match(r));
      return { data: null, error: null };
    }
    const copies = out.map((r) => ({ ...r }));
    if (this.mode === "single") return copies.length === 1 ? { data: copies[0], error: null } : { data: null, error: { message: "not one row" } };
    if (this.mode === "maybe") return { data: copies[0] ?? null, error: null };
    return { data: copies, error: null, count: this.countOpt ? copies.length : null };
  }
}

const IMG = Buffer.from("jpeg-bytes");

/** A batch with its works and photos, files in the captures bucket. */
function seed(
  db: FakeDb,
  works: { fields?: Row; photos?: { label?: boolean }[] }[],
  batch: Row = {},
) {
  const batchId = randomUUID();
  db.rows("capture_batches").push({
    id: batchId,
    captured_at: "2026-07-14T23:30:00Z",
    source_name: "Galerie Example",
    source_type: "gallery",
    ledger: "jvb",
    status: "draft",
    ...batch,
  });
  const ids: string[] = [];
  works.forEach((w, i) => {
    const id = randomUUID();
    ids.push(id);
    db.rows("capture_works").push({ id, batch_id: batchId, sort_order: i, status: "draft", pushed_at: null, pushed_piece_id: null, ...w.fields });
    (w.photos ?? []).forEach((p, j) => {
      const pid = randomUUID();
      const path = `works/${batchId}/${id}/${randomUUID()}.jpg`;
      db.rows("capture_photos").push({ id: pid, work_id: id, batch_id: batchId, storage_path: path, is_label: Boolean(p.label), sort_order: j });
      db.objects.set(`captures/${path}`, IMG);
    });
  });
  return { batchId, workIds: ids };
}

function run(db: FakeDb, batchId: string, now?: Date) {
  // @ts-ignore - the stand-in has only the methods push.ts calls
  return pushBatch({ rls: db, db, batchId, userId: "u1", now });
}

test("helpers", () => {
  // 23:30 UTC on 14 July is 00:30 on 15 July in London.
  assert.equal(londonDay("2026-07-14T23:30:00Z"), "2026-07-15");
  assert.equal(londonDay("2026-01-14T23:30:00Z"), "2026-01-14");
  assert.equal(foldName("  Unno   Shōmin "), "unno shomin");
  assert.equal(makerPattern("Unno Shomin"), "_nn_ Sh_m_n");
  assert.equal(makerPattern("Lacquer_Box 100%*"), "L_cq__r\\_B_x 100\\%_");
  assert.equal(isEmptyWork({ title: "  ", notes: null }, 0), true);
  assert.equal(isEmptyWork({ title: "Inro" }, 0), false);
  assert.equal(isEmptyWork({}, 1), false);
});

test("a push files each work once, links the maker it names and skips empty works", async () => {
  const db = new FakeDb();
  const makerId = randomUUID();
  db.rows("makers").push({ id: makerId, display_name: "Unno Shōmin" }, { id: randomUUID(), display_name: "Unno Moritoshi" });
  const { batchId, workIds } = seed(db, [
    { fields: { maker: "unno shomin", title: "Vase" }, photos: [{}, { label: true }, {}] },
    { fields: {} },
  ]);

  const out = await run(db, batchId);
  assert.equal(out.found, true);
  if (!out.found) return;
  assert.equal(out.closed, true);
  assert.equal(out.results[0]!.stockNumber, "2026-0001");
  assert.equal(out.results[0]!.incomplete, undefined);
  assert.deepEqual(out.results[1], { workId: workIds[1], skipped: true });

  const pieces = db.rows("pieces");
  assert.equal(pieces.length, 1, "no stock record for the empty work");
  assert.equal(pieces[0]!.maker_id, makerId);
  assert.equal(db.rows("makers").length, 2, "capture creates no maker");
  assert.deepEqual(
    db.rows("piece_images").map((i) => i.role),
    ["front", "document", "detail"],
  );
  assert.equal(db.rows("piece_financials")[0]!.purchase_date, "2026-07-15");
  const [w0, w1] = db.rows("capture_works");
  assert.equal(w0!.status, "pushed");
  assert.equal(w0!.pushed_piece_id, pieces[0]!.id);
  assert.equal(w1!.status, "skipped");
  assert.equal(db.rows("capture_batches")[0]!.status, "pushed");

  // Pushing again adds nothing.
  const again = await run(db, batchId);
  assert.ok(again.found && again.results.length === 0);
  assert.equal(db.rows("pieces").length, 1);
});

test("an unmatched or ambiguous maker is kept in the comments, never created", async () => {
  const db = new FakeDb();
  db.rows("makers").push(
    { id: randomUUID(), display_name: "Shibata Zeshin" },
    { id: randomUUID(), display_name: "Shibata Zéshin" },
    { id: randomUUID(), display_name: "LacquerXBoxYZ" },
  );
  const { batchId } = seed(db, [
    { fields: { maker: "Attributed to Unno Shomin" } },
    { fields: { maker: "Shibata Zeshin" } },
    { fields: { maker: "Lacquer_Box%" } },
  ]);
  const out = await run(db, batchId);
  assert.ok(out.found && out.results.every((r) => r.stockNumber));
  const pieces = db.rows("pieces");
  assert.deepEqual(pieces.map((p) => p.maker_id), [null, null, null]);
  assert.match(String(pieces[0]!.comments), /^Maker \(from capture\): Attributed to Unno Shomin$/m);
  assert.match(String(pieces[1]!.comments), /Maker \(from capture\): Shibata Zeshin/);
  assert.match(String(pieces[2]!.comments), /Maker \(from capture\): Lacquer_Box%/);
  assert.equal(db.rows("makers").length, 3);
});

test("two pushes at once create each stock record once", async () => {
  const db = new FakeDb();
  const { batchId } = seed(db, [
    { fields: { title: "A" }, photos: [{}, {}] },
    { fields: { title: "B" }, photos: [{}] },
    { fields: { title: "C" }, photos: [{}, {}, {}] },
  ]);
  const [a, b] = await Promise.all([run(db, batchId), run(db, batchId)]);
  assert.equal(db.rows("pieces").length, 3);
  assert.equal(db.rows("piece_images").length, 6);
  const all = [...(a.found ? a.results : []), ...(b.found ? b.results : [])];
  assert.equal(all.filter((r) => r.stockNumber && !r.incomplete).length, 3);
  assert.ok(all.filter((r) => r.busy).length + all.filter((r) => r.stockNumber).length >= 3);
  assert.ok(db.rows("capture_works").every((w) => w.status === "pushed"));
});

test("a photo that fails to copy keeps the work to push again, on the same record", async () => {
  const db = new FakeDb();
  const { batchId } = seed(db, [{ fields: { title: "Inro" }, photos: [{}, {}] }]);
  const second = db.rows("capture_photos")[1]!;
  db.failDownloadOnce.add(`captures/${second.storage_path}`);

  const first = await run(db, batchId);
  assert.ok(first.found);
  if (!first.found) return;
  assert.equal(first.results[0]!.incomplete, true);
  assert.equal(first.results[0]!.photosFailed, 1);
  assert.equal(first.closed, false);
  const work = db.rows("capture_works")[0]!;
  assert.equal(work.status, "draft");
  assert.equal(work.pushed_at, null, "the claim is released");
  assert.ok(work.pushed_piece_id);

  const retry = await run(db, batchId);
  assert.ok(retry.found && retry.results[0]!.stockNumber === "2026-0001" && !retry.results[0]!.incomplete);
  assert.equal(db.rows("pieces").length, 1);
  assert.equal(db.rows("piece_images").length, 2);
  assert.equal(db.rows("capture_works")[0]!.status, "pushed");
  assert.equal(db.rows("capture_batches")[0]!.status, "pushed");
});

test("a push cut off part way is resumed after the claim lapses, not duplicated", async () => {
  const db = new FakeDb();
  const { batchId } = seed(db, [{ fields: { title: "Netsuke" }, photos: [{}, {}] }]);
  const photo = db.rows("capture_photos")[1]!;
  const t0 = new Date("2026-07-15T10:00:00Z");
  const reached = new Promise<void>((r) => db.hang.set(`captures/${photo.storage_path}`, r));
  void run(db, batchId, t0); // never finishes: the platform cut it off
  await reached;
  db.hang.clear();
  assert.equal(db.rows("pieces").length, 1);

  // While the claim holds, another push leaves the work alone.
  const during = await run(db, batchId, new Date(t0.getTime() + 60_000));
  assert.ok(during.found && during.results[0]!.busy === true);

  const later = await run(db, batchId, new Date(t0.getTime() + (LEASE_MINUTES + 1) * 60_000));
  assert.ok(later.found && later.results[0]!.stockNumber === "2026-0001");
  assert.equal(db.rows("pieces").length, 1);
  assert.equal(db.rows("piece_images").length, 2);
  assert.equal(db.rows("capture_works")[0]!.status, "pushed");
});

test("a failed piece insert leaves the work free to push again", async () => {
  const db = new FakeDb();
  const { batchId } = seed(db, [{ fields: { title: "Tsuba" }, photos: [{}] }]);
  db.failOps.add("pieces:insert");
  const out = await run(db, batchId);
  assert.ok(out.found && out.results[0]!.error);
  const work = db.rows("capture_works")[0]!;
  assert.equal(work.status, "draft");
  assert.equal(work.pushed_at, null);
  db.failOps.clear();
  const retry = await run(db, batchId);
  assert.ok(retry.found && retry.results[0]!.stockNumber);
  assert.equal(db.rows("pieces").length, 1);
});

/** An invoice with one page (and its squared version) in the captures bucket. */
function seedInvoice(db: FakeDb, inv: Row) {
  const id = randomUUID();
  db.rows("capture_invoices").push({ id, vendor: "Dealer C", invoice_date: "2026-07-10", total: 1250, currency: "EUR", ...inv });
  const page = randomUUID();
  const original = `invoices/${id}/${randomUUID()}.jpg`;
  const squared = `invoices/${id}/${randomUUID()}.jpg`;
  db.rows("capture_invoice_pages").push({ id: page, invoice_id: id, storage_path: original, squared_path: squared, page_no: 1 });
  db.objects.set(`captures/${original}`, IMG);
  db.objects.set(`captures/${squared}`, Buffer.from("squared"));
  return { id, page };
}

test("a linked invoice is attached once; cost only when it covers one item", async () => {
  const db = new FakeDb();
  const { batchId, workIds } = seed(db, [{ fields: { title: "Box" }, photos: [{}] }]);
  const solo = seedInvoice(db, {});
  db.rows("capture_invoice_links").push({ invoice_id: solo.id, work_id: workIds[0], piece_id: null });

  await run(db, batchId);
  const piece = db.rows("pieces")[0]!;
  const docs = db.rows("piece_documents");
  assert.equal(docs.length, 1);
  assert.equal(docs[0]!.storage_path, `${piece.id}/${solo.page}.jpg`);
  assert.equal(db.objects.get(`piece-documents/${piece.id}/${solo.page}.jpg`)?.toString(), "squared");
  const fin = db.rows("piece_financials")[0]!;
  assert.equal(fin.purchase_invoice_document_id, docs[0]!.id);
  assert.equal(fin.purchase_date, "2026-07-10", "the invoice date wins over the batch day");
  assert.equal(fin.purchase_cost, 1250);
  assert.equal(fin.purchase_currency, "EUR");

  // Attaching again (a second Save on the link screen) changes nothing.
  // @ts-ignore - the stand-in
  assert.equal(await attachInvoiceToPiece(db, db.rows("capture_invoices")[0], piece.id, { prefill: true, setCost: true }), true);
  assert.equal(db.rows("piece_documents").length, 1);
});

test("an invoice covering a captured work and an existing record prefills no cost, and never replaces one", async () => {
  const db = new FakeDb();
  const { batchId, workIds } = seed(db, [{ fields: { title: "Box" } }]);
  const existing = randomUUID();
  db.rows("piece_ref").push({ id: existing, ledger: "jvb" });
  db.rows("piece_financials").push({ piece_id: existing, purchase_date: null, purchase_cost: 900, purchase_currency: "GBP", purchase_invoice_document_id: null });
  const inv = seedInvoice(db, {});
  db.rows("capture_invoice_links").push(
    { invoice_id: inv.id, work_id: workIds[0], piece_id: null },
    { invoice_id: inv.id, work_id: null, piece_id: existing },
  );

  await run(db, batchId);
  const fin = db.rows("piece_financials").find((f) => f.piece_id === db.rows("pieces")[0]!.id)!;
  assert.equal(fin.purchase_cost, null, "the total covers two items");
  assert.equal(fin.purchase_date, "2026-07-10");

  // @ts-ignore - the stand-in
  assert.equal(await attachInvoiceToPiece(db, db.rows("capture_invoices")[0], existing, { prefill: true, setCost: true }), true);
  const old = db.rows("piece_financials").find((f) => f.piece_id === existing)!;
  assert.equal(old.purchase_cost, 900, "a cost already entered stays");
  assert.equal(old.purchase_date, "2026-07-10");
  assert.ok(old.purchase_invoice_document_id);
});

test("several invoices on one work are all attached, with no figures guessed", async () => {
  const db = new FakeDb();
  const { batchId, workIds } = seed(db, [{ fields: { title: "Box" } }]);
  const a = seedInvoice(db, { created_at: "2026-07-10T10:00:00Z" });
  const b = seedInvoice(db, { created_at: "2026-07-11T10:00:00Z", total: 80, invoice_date: "2026-07-11" });
  db.rows("capture_invoice_links").push(
    { invoice_id: a.id, work_id: workIds[0], piece_id: null },
    { invoice_id: b.id, work_id: workIds[0], piece_id: null },
  );
  await run(db, batchId);
  assert.equal(db.rows("piece_documents").length, 2);
  const fin = db.rows("piece_financials")[0]!;
  assert.equal(fin.purchase_cost, null);
  assert.equal(fin.purchase_invoice_document_id, null);
  assert.equal(fin.purchase_date, "2026-07-15", "the batch's London day");
});

test("the batch stays open when the remaining count cannot be read", async () => {
  const db = new FakeDb();
  const { batchId } = seed(db, [{ fields: { title: "A" } }]);
  const original = db.from.bind(db);
  // The final head-count select fails; everything else works.
  db.from = (table: string) => {
    const q = original(table);
    if (table !== "capture_works") return q;
    const select = q.select.bind(q);
    q.select = (cols?: string, opts?: { count?: string; head?: boolean }) =>
      opts?.head ? (Object.assign(select(cols, opts), { then: (res: (v: unknown) => unknown) => Promise.resolve(res({ data: null, error: { message: "timeout" }, count: null })) }) as never) : select(cols, opts);
    return q;
  };
  const out = await run(db, batchId);
  assert.ok(out.found && out.closed === false);
  assert.equal(db.rows("capture_batches")[0]!.status, "draft");
});

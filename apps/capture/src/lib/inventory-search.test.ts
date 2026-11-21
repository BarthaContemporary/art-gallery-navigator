// node --test apps/capture/src/lib/inventory-search.test.ts
// The capture inventory search against a stand-in for the two calls it makes:
// rpc("pieces_search").select("id").limit(n) and vw_pieces_list .in("id", ids).
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { INVENTORY_SEARCH_LIMIT, searchInventory } from "./inventory-search.ts";

type Row = Record<string, unknown>;
type Call = { kind: "rpc" | "from"; name: string; args?: Row; columns?: string; limit?: number; in?: unknown[] };

/** A work in vw_pieces_list (a trashed one is simply absent). */
const work = (n: number, over: Row = {}): Row => ({
  id: `w${n}`,
  stock_number: `2026-${String(n).padStart(4, "0")}`,
  title: `Work ${n}`,
  maker_name: n % 2 ? "Shibata Zeshin" : null,
  description: "never selected",
  ...over,
});

function fake(opts: { ranked: string[]; view: Row[]; rpcError?: string; viewError?: string }) {
  const calls: Call[] = [];
  const answer = (data: unknown, error?: string) => Promise.resolve(error ? { data: null, error: { message: error } } : { data, error: null });
  const client = {
    rpc(name: string, args: Row) {
      const call: Call = { kind: "rpc", name, args };
      calls.push(call);
      return {
        select(columns: string) {
          call.columns = columns;
          return {
            limit(n: number) {
              call.limit = n;
              return answer(
                opts.ranked.slice(0, n).map((id) => ({ id })),
                opts.rpcError,
              );
            },
          };
        },
      };
    },
    from(name: string) {
      const call: Call = { kind: "from", name };
      calls.push(call);
      return {
        select(columns: string) {
          call.columns = columns;
          return {
            in(column: string, values: unknown[]) {
              assert.equal(column, "id");
              call.in = values;
              const cols = columns.split(",").map((c) => c.trim());
              // Any order: .in() does not keep the rank, so give them back reversed.
              const rows = opts.view
                .filter((r) => values.includes(r.id))
                .reverse()
                .map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
              return answer(rows, opts.viewError);
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test("ranked by pieces_search, rows from vw_pieces_list, in rank order, in the route's shape", async () => {
  const view = [work(1), work(2), work(3)];
  const db = fake({ ranked: ["w3", "w1", "w2"], view });
  const { results, error } = await searchInventory(db.client as never, "Zeshin");
  assert.equal(error, null);
  assert.deepEqual(results, [
    { id: "w3", stock_number: "2026-0003", title: "Work 3", maker: "Shibata Zeshin" },
    { id: "w1", stock_number: "2026-0001", title: "Work 1", maker: "Shibata Zeshin" },
    { id: "w2", stock_number: "2026-0002", title: "Work 2", maker: null },
  ]);
  const [rpc, from] = db.calls;
  assert.deepEqual(rpc, { kind: "rpc", name: "pieces_search", args: { q: "Zeshin" }, columns: "id", limit: INVENTORY_SEARCH_LIMIT });
  assert.equal(from?.name, "vw_pieces_list", "never vw_pieces_all, which includes the trash");
  assert.equal(from?.columns, "id, stock_number, title, maker_name");
  assert.equal(db.calls.length, 2);
});

test("at most 15, and a ranked id that does not load (trashed, hidden) is left out", async () => {
  const view = Array.from({ length: 30 }, (_, i) => work(i + 1)).filter((r) => r.id !== "w2");
  const ranked = Array.from({ length: 30 }, (_, i) => `w${i + 1}`);
  const db = fake({ ranked, view });
  const { results } = await searchInventory(db.client as never, "Work");
  assert.equal(INVENTORY_SEARCH_LIMIT, 15);
  assert.equal(db.calls[1]?.in?.length, 15);
  assert.deepEqual(
    results.map((r: { id: string }) => r.id),
    ["w1", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10", "w11", "w12", "w13", "w14", "w15"],
  );
});

test("the query goes in as the RPC parameter, as typed", async () => {
  const db = fake({ ranked: [], view: [] });
  const q = "Box (lacquer), No. 12 or=(id.eq.x)";
  const { results, error } = await searchInventory(db.client as never, q);
  assert.deepEqual(results, []);
  assert.equal(error, null);
  assert.deepEqual(db.calls[0]?.args, { q });
  assert.equal(db.calls.length, 1, "no row read when nothing matched");
});

test("a failed search or row read comes back as the error, with no rows", async () => {
  const a = await searchInventory(fake({ ranked: ["w1"], view: [work(1)], rpcError: "boom" }).client as never, "x1");
  assert.deepEqual(a, { results: [], error: { message: "boom" } });
  const b = await searchInventory(fake({ ranked: ["w1"], view: [work(1)], viewError: "denied" }).client as never, "x1");
  assert.deepEqual(b, { results: [], error: { message: "denied" } });
});

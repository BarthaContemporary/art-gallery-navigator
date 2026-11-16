// node --test apps/studio/src/lib/paged-read.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectAllRows } from "./paged-read.ts";

/** A table behind a server that returns at most `cap` rows per request. */
function server(rows: number[], cap: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap);
    return { data: rows.slice(from, end), error: null };
  };
  return { page, calls };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

test("reads past the server's row cap", async () => {
  const { page, calls } = server(range(2345), 1000);
  const out = await selectAllRows(page);
  assert.deepEqual(out, range(2345));
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
    [2345, 3344],
  ]);
});

test("a cap below the page size still reads everything", async () => {
  const { page } = server(range(1234), 500);
  assert.deepEqual(await selectAllRows(page), range(1234));
});

test("exactly one full page, and an empty table", async () => {
  assert.deepEqual(await selectAllRows(server(range(1000), 1000).page), range(1000));
  const empty = server([], 1000);
  assert.deepEqual(await selectAllRows(empty.page), []);
  assert.equal(empty.calls.length, 1);
});

test("an error on any page fails the whole read", async () => {
  let n = 0;
  const page = async (from: number, to: number) => {
    n++;
    if (n === 2) return { data: null, error: { message: "upstream timeout" } };
    return { data: range(to - from + 1), error: null };
  };
  await assert.rejects(selectAllRows(page), /upstream timeout/);
});

// node --test infra/image-worker/src/runtime.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimLimit,
  isMissingObject,
  isNotFound,
  isTransient,
  MAX_ATTEMPTS,
  planBatch,
  positiveInt,
  retryDelaySeconds,
  runLimited,
  TransientError,
} from "./runtime.ts";

test("numeric settings: empty or junk falls back to the default, never 0", () => {
  assert.deepEqual(positiveInt(undefined, 5), { value: 5, invalid: false });
  assert.deepEqual(positiveInt("", 5), { value: 5, invalid: false }); // compose's unset ${VAR}
  assert.deepEqual(positiveInt("  ", 5), { value: 5, invalid: false });
  assert.deepEqual(positiveInt("10", 5), { value: 10, invalid: false });
  for (const bad of ["0", "-3", "2.5", "abc", "1e400"]) {
    assert.deepEqual(positiveInt(bad, 60_000), { value: 60_000, invalid: true }, bad);
  }
});

test("passing failures are told from lasting ones", () => {
  assert.ok(isTransient(new TransientError("upload failed")));
  assert.ok(isTransient(Object.assign(new Error("terminating connection"), { code: "57P01" })));
  assert.ok(isTransient(Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" })));
  assert.ok(isTransient(Object.assign(new Error("could not connect"), { code: "08006" })));
  assert.ok(!isTransient(new Error("Input buffer contains unsupported image format")));
  assert.ok(!isTransient(Object.assign(new Error("syntax"), { code: "42601" })));
  assert.ok(!isTransient(null));
  assert.ok(isNotFound("download failed: Object not found"));
  assert.ok(!isNotFound("download failed: fetch failed"));
});

test("a missing 0099 function or column is recognised", () => {
  assert.ok(isMissingObject({ code: "42883" }));
  assert.ok(isMissingObject({ code: "42703" }));
  assert.ok(isMissingObject({ code: "42501" })); // not granted to this role
  assert.ok(!isMissingObject({ code: "57P01" }));
  assert.ok(!isMissingObject(new Error("x")));
});

test("retries wait longer the second time and stop at the limit", () => {
  assert.ok(retryDelaySeconds(1) < retryDelaySeconds(2));
  assert.equal(MAX_ATTEMPTS, 3);
});

test("runLimited keeps to the limit and hands back what it never started", async () => {
  let running = 0;
  let peak = 0;
  const done: number[] = [];
  let stop = false;
  const skipped = await runLimited(
    [1, 2, 3, 4, 5, 6],
    2,
    async (n) => {
      running++;
      peak = Math.max(peak, running);
      if (n === 2) stop = true; // shutdown arrives while 1 and 2 run
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      running--;
    },
    () => stop,
  );
  assert.equal(peak, 2);
  assert.deepEqual(done.sort(), [1, 2]);
  assert.deepEqual(skipped, [3, 4, 5, 6]);

  const all = await runLimited([1, 2, 3], 10, async () => {}, () => false);
  assert.deepEqual(all, []);
  assert.deepEqual(await runLimited([], 2, async () => {}, () => false), []);
});

test("a claim takes no more rows than are worked on at once", () => {
  assert.equal(claimLimit(10, 2), 2); // .env.example's batch, default concurrency
  assert.equal(claimLimit(1, 2), 1);
  assert.equal(claimLimit(5, 5), 5);
  assert.equal(claimLimit(0, 0), 1);
});

test("a row tried before runs last and alone; fresh rows keep their order and width", () => {
  const fresh = [{ id: "a", processing_attempts: 0 }, { id: "b", processing_attempts: 0 }];
  assert.deepEqual(planBatch(fresh, 2), { rows: fresh, concurrency: 2 });

  // Lease mode: b crashed the worker once (or failed a passing error).
  const mixed = [
    { id: "b", processing_attempts: 1 },
    { id: "a", processing_attempts: 0 },
    { id: "c", processing_attempts: 2 },
    { id: "d", processing_attempts: 0 },
  ];
  const plan = planBatch(mixed, 2);
  assert.deepEqual(plan.rows.map((r) => r.id), ["a", "d", "b", "c"]);
  assert.equal(plan.concurrency, 1);
  assert.equal(mixed[0]?.id, "b", "the claimed batch itself is not reordered");

  // Without 0099 rows carry no count: claim order, full width.
  const legacy = [{ id: "x" }, { id: "y" }];
  assert.deepEqual(planBatch(legacy, 2), { rows: legacy, concurrency: 2 });
  assert.deepEqual(planBatch([], 2), { rows: [], concurrency: 2 });
});

test("one at a time, a crash on the tried row finds the others finished or not started", async () => {
  // The worker dies (stop) while the tried row runs: the fresh row before it
  // is done, and nothing else was in hand to lose a try.
  const plan = planBatch(
    [
      { id: "poison", processing_attempts: 1 },
      { id: "fresh", processing_attempts: 0 },
    ],
    2,
  );
  const inHandWithPoison: string[] = [];
  const running = new Set<string>();
  let died = false;
  await runLimited(
    plan.rows,
    plan.concurrency,
    async (row) => {
      running.add(row.id);
      if (row.id === "poison") {
        inHandWithPoison.push(...[...running].filter((id) => id !== "poison"));
        died = true;
      }
      await new Promise((r) => setTimeout(r, 2));
      running.delete(row.id);
    },
    () => died,
  );
  assert.deepEqual(inHandWithPoison, []);
});

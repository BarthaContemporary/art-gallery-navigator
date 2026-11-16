// node --test infra/image-worker/src/runtime.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMissingObject,
  isNotFound,
  isTransient,
  MAX_ATTEMPTS,
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

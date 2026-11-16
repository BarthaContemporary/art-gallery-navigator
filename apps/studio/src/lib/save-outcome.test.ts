// node --test apps/studio/src/lib/save-outcome.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { asOutcome, FINAL_STATUSES, readSaveOutcome, refusalMessage } from "./save-outcome.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a 2xx answer is a save", async () => {
  assert.deepEqual(await readSaveOutcome(json(200, { ok: true })), { ok: true, status: 200 });
  assert.equal((await readSaveOutcome(new Response(null, { status: 204 }))).ok, true);
});

test("401 says signed out, and is tried again (not final)", async () => {
  const o = await readSaveOutcome(json(401, { error: "Unauthorized" }));
  assert.equal(o.ok, false);
  assert.equal(o.signedOut, true);
  assert.equal(o.final, undefined);
});

test("403 and 404 are final and carry the route's own words", async () => {
  const forbidden = await readSaveOutcome(json(403, { error: "Only admin can change the purchase price" }));
  assert.deepEqual(forbidden, {
    ok: false,
    status: 403,
    final: true,
    message: "Only admin can change the purchase price.",
  });
  const gone = await readSaveOutcome(json(404, { error: "Maker not found, or not yours to edit" }));
  assert.equal(gone.final, true);
  assert.equal(gone.message, "Maker not found, or not yours to edit.");
});

test("a bare route text gives the default sentence for the status", async () => {
  assert.equal((await readSaveOutcome(json(403, { error: "Forbidden" }))).message, "Your role cannot change this.");
  assert.match((await readSaveOutcome(json(404, { error: "Not found" }))).message ?? "", /not found/i);
  // No JSON body at all.
  const plain = await readSaveOutcome(new Response("<html>nope</html>", { status: 403 }));
  assert.equal(plain.final, true);
  assert.equal(plain.message, "Your role cannot change this.");
});

test("validation refusals are final too, so a bad value is not resent every 30 s", async () => {
  for (const s of [400, 409, 410, 413, 422]) assert.equal(FINAL_STATUSES.has(s), true, String(s));
  const o = await readSaveOutcome(json(400, { error: "Name is required" }));
  assert.equal(o.final, true);
  assert.equal(o.message, "Name is required.");
});

test("server errors, timeouts and rate limits are retried", async () => {
  for (const s of [500, 502, 503, 504, 408, 429]) {
    const o = await readSaveOutcome(json(s, { error: "boom" }));
    assert.equal(o.ok, false, String(s));
    assert.equal(o.final, undefined, String(s));
    assert.equal(o.signedOut, undefined, String(s));
  }
});

test("refusalMessage trims, caps and ends the sentence", () => {
  assert.equal(refusalMessage(403, "  You can't edit\n this  "), "You can't edit this.");
  assert.equal(refusalMessage(403, "Done!"), "Done!");
  assert.equal(refusalMessage(418, undefined), "The server refused it.");
  assert.equal(refusalMessage(400, 42), "The server did not accept these values.");
  assert.ok(refusalMessage(400, "x".repeat(500)).length <= 201);
});

test("asOutcome reads the old boolean answers and a missing one", () => {
  assert.deepEqual(asOutcome(true), { ok: true });
  assert.deepEqual(asOutcome(false), { ok: false });
  assert.deepEqual(asOutcome(null), { ok: false });
  assert.deepEqual(asOutcome({ ok: false, final: true, message: "x." }), { ok: false, final: true, message: "x." });
});

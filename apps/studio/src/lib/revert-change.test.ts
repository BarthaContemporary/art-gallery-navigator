// node --test apps/studio/src/lib/revert-change.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { canReinstate, NOT_REINSTATED, reinstatePatch } from "./revert-change.ts";

const entry = (entityType: string | null, changes: Record<string, unknown> | null, action = "UPDATE") => ({
  action,
  entityType,
  changes,
});

test("the patch holds the prior value of every changed field that may be written back", () => {
  assert.deepEqual(
    reinstatePatch({
      title: { old: "Tea bowl", new: "Tea bowl, Karatsu" },
      location_id: { old: null, new: "loc-1" },
      status: { old: "in_stock" }, // a diff always has old; new may be absent
      updated_at: { old: "2026-11-01T10:00:00Z", new: "2026-11-02T10:00:00Z" },
      margin_gbp: { old: 100, new: 120 },
      noOld: { new: "x" },
    }),
    { title: "Tea bowl", location_id: null, status: "in_stock" },
  );
});

test("a register move has nothing Reinstate writes back, so the button is not offered", () => {
  const move = { ledger: { old: "jvb", new: "external" }, stock_number: { old: "A-1", new: "E-1" } };
  assert.deepEqual(reinstatePatch(move), {});
  assert.equal(canReinstate(entry("external_pieces", move)), false);
});

test("only edits of a work, its financials, with something left to put back, offer Reinstate", () => {
  const edit = { title: { old: "a", new: "b" } };
  assert.equal(canReinstate(entry("pieces", edit)), true);
  assert.equal(canReinstate(entry("external_pieces", edit)), true);
  assert.equal(canReinstate(entry("piece_financials", { marked_price_gbp: { old: 900, new: 950 } })), true);
  assert.equal(canReinstate(entry("piece_financials", { total_cost_gbp: { old: 1, new: 2 } })), false);
  assert.equal(canReinstate(entry("crm_contacts", edit)), false);
  assert.equal(canReinstate(entry(null, edit)), false);
  assert.equal(canReinstate(entry("pieces", edit, "INSERT")), false);
  assert.equal(canReinstate(entry("pieces", null)), false);
  // Created/deleted rows log the whole row under new/old, not a diff.
  assert.equal(canReinstate(entry("pieces", { old: { title: "a" } })), false);
});

test("identity, bookkeeping and generated columns are never written back", () => {
  for (const k of ["id", "piece_id", "stock_number", "ledger", "deleted_at", "search_vector", "updated_by"]) {
    assert.ok(NOT_REINSTATED.has(k), k);
  }
});

test("the record page and ChangeHistory both use these rules", () => {
  const page = readFileSync(new URL("../app/(app)/inventory/[stockNumber]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const patch = reinstatePatch\(entry\.changes as Record<string, unknown>\);/);
  assert.doesNotMatch(page, /const IMMUTABLE = new Set/);
  const history = readFileSync(new URL("../components/change-history.tsx", import.meta.url), "utf8");
  assert.match(history, /revertAction && diffKeys\.length > 0 && canReinstate\(e\)/);
});

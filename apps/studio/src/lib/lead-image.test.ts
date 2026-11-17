// node --test apps/studio/src/lib/lead-image.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareLeadImages, pickLeadImages } from "./lead-image.ts";

const img = (id: string, piece: string, role: string, sort: number, created = "2026-10-01T10:00:00Z", status = "done") => ({
  id,
  piece_id: piece,
  role,
  sort_order: sort,
  created_at: created,
  processing_status: status,
});

test("the front shot leads even when a label was photographed first", () => {
  const rows = [img("label", "w1", "document", 0), img("back", "w1", "back", 1), img("front", "w1", "front", 2)];
  assert.equal(pickLeadImages(rows).get("w1")?.id, "front");
});

test("without a front shot: lowest sort order, then the oldest", () => {
  const rows = [
    img("d2", "w1", "detail", 2),
    img("d1-new", "w1", "detail", 1, "2026-10-02T10:00:00Z"),
    img("d1-old", "w1", "detail", 1, "2026-10-01T10:00:00Z"),
  ];
  assert.equal(pickLeadImages(rows).get("w1")?.id, "d1-old");
  assert.ok(compareLeadImages(rows[2]!, rows[1]!) < 0);
});

test("a failed photograph never leads; excluded roles and refused rows are passed over", () => {
  const rows = [
    img("broken-front", "w1", "front", 0, undefined, "error"),
    img("label", "w1", "document", 0),
    img("side", "w1", "side", 3),
    img("other-bucket", "w2", "front", 0),
    img("w2-detail", "w2", "detail", 1),
  ];
  const lead = pickLeadImages(rows, {
    excludeRoles: ["document"],
    usable: (r) => r.id !== "other-bucket",
  });
  assert.equal(lead.get("w1")?.id, "side");
  assert.equal(lead.get("w2")?.id, "w2-detail");
  // Without the exclusion the label (sort 0) would lead w1.
  assert.equal(pickLeadImages(rows).get("w1")?.id, "label");
});

test("a work with nothing usable has no entry", () => {
  const lead = pickLeadImages([img("label", "w1", "document", 0)], { excludeRoles: ["document"] });
  assert.equal(lead.has("w1"), false);
});

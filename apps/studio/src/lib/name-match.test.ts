// node --test apps/studio/src/lib/name-match.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { namePattern, pickSameName } from "./name-match.ts";

/** PostgREST then Postgres ILIKE: every * becomes %, then \ escapes, % any run, _ one character. */
function ilike(value: string, pattern: string): boolean {
  const p = pattern.replace(/\*/g, "%");
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i]!;
    if (c === "\\" && i + 1 < p.length) re += p[++i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i").test(value);
}

const lookup = (names: string[], typed: string) =>
  pickSameName(
    names.filter((n) => ilike(n, namePattern(typed))).map((name) => ({ name })),
    typed,
    (r) => r.name,
  )?.name;

test("namePattern escapes the LIKE wildcards and makes * one character", () => {
  assert.equal(namePattern("Lacquer"), "Lacquer");
  assert.equal(namePattern("50% off_cut\\x*"), "50\\% off\\_cut\\\\x_");
});

test("a plain name finds itself in any case, as before", () => {
  assert.equal(lookup(["Lacquer", "Lacquer ware"], "lacquer"), "Lacquer");
  assert.equal(lookup(["Shibata Zeshin"], "SHIBATA ZESHIN"), "Shibata Zeshin");
  assert.equal(lookup(["Lacquer ware"], "Lacquer"), undefined);
});

test("wildcard characters in a name match only themselves", () => {
  assert.equal(lookup(["Lacquer ware", "LacquerXBox"], "Lacquer*"), undefined);
  assert.equal(lookup(["Lacquer ware", "Lacquer*"], "lacquer*"), "Lacquer*");
  assert.equal(lookup(["Box_A", "BoxXA"], "box_a"), "Box_A");
  assert.equal(lookup(["BoxXA"], "Box_A"), undefined);
  assert.equal(lookup(["100% silk", "100 silk"], "100% silk"), "100% silk");
  assert.equal(lookup(["100 silk", "1000 silk"], "100% silk"), undefined);
});

test("pickSameName with no rows", () => {
  assert.equal(pickSameName(null, "x", (r: { name: string }) => r.name), undefined);
});

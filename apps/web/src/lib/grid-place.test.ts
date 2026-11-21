// node --test apps/web/src/lib/grid-place.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gridPlaceKey, gridPlaceSaver, readGridPlace, writeGridPlace } from "./grid-place.ts";

function memoryStore() {
  const m = new Map<string, string>();
  return {
    map: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

test("a place written under a page's key reads back", () => {
  const s = memoryStore();
  writeGridPlace(s, gridPlaceKey("/"), { visible: 70, y: 5400 });
  assert.deepEqual(readGridPlace(s, gridPlaceKey("/")), { visible: 70, y: 5400 });
  assert.equal(readGridPlace(s, gridPlaceKey("/publications")), null);
});

test("the save made on leaving files the place under the page the grid mounted on", () => {
  // web-pages-3: the unmount cleanup runs after Next has pushed the next URL.
  const s = memoryStore();
  let pathname = "/"; // the home archive mounts
  let visible = 16;
  let y = 0;
  const save = gridPlaceSaver(gridPlaceKey(pathname), () => ({ visible, y }), () => s);

  visible = 70; // the reader scrolls deep into the archive
  y = 5400;
  pathname = "/events/tefaf-2026"; // opens an event: the URL changes first
  save(); // then the home grid's cleanup runs

  assert.deepEqual(readGridPlace(s, gridPlaceKey("/")), { visible: 70, y: 5400 });
  assert.equal(readGridPlace(s, gridPlaceKey(pathname)), null, "nothing filed under the event page");
});

test("another page's grid never overwrites the home page's place", () => {
  const s = memoryStore();
  writeGridPlace(s, gridPlaceKey("/"), { visible: 48, y: 3000 });
  // A grid on /publications, scrolled down; the header link goes home.
  const savePublications = gridPlaceSaver(gridPlaceKey("/publications"), () => ({ visible: 32, y: 1800 }), () => s);
  savePublications(); // runs when the address bar already shows "/"
  assert.deepEqual(readGridPlace(s, gridPlaceKey("/")), { visible: 48, y: 3000 });
  assert.deepEqual(readGridPlace(s, gridPlaceKey("/publications")), { visible: 32, y: 1800 });
});

test("damaged or partial values read as nothing saved", () => {
  const s = memoryStore();
  const key = gridPlaceKey("/");
  for (const raw of ["not json", "null", "{}", '{"visible":"12","y":0}', '{"visible":12}', "[1,2]"]) {
    s.map.set(key, raw);
    assert.equal(readGridPlace(s, key), null, raw);
  }
});

test("InfiniteGrid takes its key once, at mount, and saves under it", () => {
  const src = readFileSync(new URL("../components/infinite-grid.tsx", import.meta.url), "utf8");
  // Fixed in the mount effects, never re-read from the address bar at save time.
  assert.match(src, /placeKey\.current \?\?= gridPlaceKey\(window\.location\.pathname\);/);
  assert.match(src, /const save = gridPlaceSaver\(placeKey\.current,/);
  assert.match(src, /readGridPlace\(session\(\), placeKey\.current\)/);
  assert.doesNotMatch(src, /const storageKey = \(\) =>/);
  // pagehide and the unmount cleanup both use that one save.
  assert.match(src, /window\.addEventListener\("pagehide", save\);/);
  assert.match(src, /window\.removeEventListener\("pagehide", save\);\n\s+save\(\);/);
});

test("blocked storage is ignored on read, on write, and when reaching it throws", () => {
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(readGridPlace(throwing, "k"), null);
  assert.equal(readGridPlace(null, "k"), null);
  assert.doesNotThrow(() => writeGridPlace(throwing, "k", { visible: 1, y: 1 }));
  assert.doesNotThrow(() => writeGridPlace(undefined, "k", { visible: 1, y: 1 }));
  const save = gridPlaceSaver(
    "k",
    () => ({ visible: 1, y: 1 }),
    () => {
      throw new Error("SecurityError");
    },
  );
  assert.doesNotThrow(save);
});

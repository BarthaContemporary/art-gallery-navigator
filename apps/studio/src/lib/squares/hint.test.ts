// node --test apps/studio/src/lib/squares/hint.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { flatWorkHint } from "./hint.ts";

test("objects whose titles or mediums use everyday flat-work words are not flat works", () => {
  for (const [medium, title] of [
    ["Bamboo and rattan", "Hanging flower basket"],
    ["Madake bamboo and rattan", "Hanging flower basket in the form of a gourd"],
    ["Bronze", "Oil lamp with peacock finial"],
    ["Lacquer on wood", "Writing box with ink stone"],
    ["Stoneware", "Seto oil plate"],
    ["Bamboo", "Miniature flower basket"],
    ["Lacquered paper (ikkanbari)", "Tea caddy"],
    ["Bronze", "Scroll weights"],
    ["Wood", "Go board"],
    ["Bamboo with silk cord", "Flower basket, 'Autumn Wind'"],
    ["Red lacquer on wood", "Black lacquer box with maki-e cranes"],
    ["Stoneware with black glaze", "Black-glazed stoneware object"],
    ["Bronze with silver inlay", "Silver-inlaid bronze dish"],
    ["Wood with mother-of-pearl inlay", "Inlaid wooden box"],
    ["Bronze", "Bronze mandala"],
    [null, "Boat-shaped flower basket"],
  ] as const) {
    assert.equal(flatWorkHint(medium, title), false, `${medium} / ${title}`);
  }
});

test("real flat works keep the hint", () => {
  for (const [medium, title] of [
    ["Ink on Japanese paper", "Ink study, brushed circle"],
    ["Gouache on paper", "Tantric painting, Shiva lingam"],
    ["Gouache on recycled paper", "Shri Yantra"],
    ["Gouache and ink on paper", "Astrological manuscript page"],
    ["Woodblock print", "Untitled"],
    ["Gelatin silver print", "Untitled"],
    ["Lithograph", "From Point"],
    ["Screenprint", "Untitled (Autoroute)"],
    ["Oil on canvas", "Untitled abstraction"],
    ["Acrylic on canvas", "Landscape with red sun"],
    ["Ink and colour on silk", "Cranes"],
    ["Opaque watercolour and gold on paper", "Krishna and Radha"],
    ["Indigo-dyed cotton", "Indigo boro textile"],
    ["Cotton with running stitch", "Kantha embroidered cloth"],
    ["Silk with metallic thread", "Fukusa"],
    [null, "Kakemono"],
    [null, "Hanging scroll, plum blossom"],
    ["", "Thangka of Green Tara"],
    [undefined, "Miniature painting, a prince hunting"],
  ] as const) {
    assert.equal(flatWorkHint(medium, title), true, `${medium} / ${title}`);
  }
});

test("nothing to go on is no hint", () => {
  assert.equal(flatWorkHint(null, null), false);
  assert.equal(flatWorkHint("", ""), false);
  assert.equal(flatWorkHint(undefined, undefined), false);
});

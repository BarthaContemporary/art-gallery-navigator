// node --test infra/image-worker/src/master.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { displayMaster } from "./master.ts";

const options = { rotation: 0, maxDimension: 4096, maxInputPixels: 100_000_000, quality: 85 };

async function corner(jpeg: Buffer): Promise<number[]> {
  const { data } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  return [data[0]!, data[1]!, data[2]!];
}

/** 40×40 with a transparent background and an opaque red square in the middle. */
async function cutOut(format: "png" | "webp"): Promise<Buffer> {
  const red = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: red, left: 10, top: 10 }])
    [format]()
    .toBuffer();
}

test("a transparent background becomes white, not black", async () => {
  for (const format of ["png", "webp"] as const) {
    const { data, info } = await displayMaster(await cutOut(format), options);
    assert.equal(info.format, "jpeg");
    const [r, g, b] = await corner(data);
    assert.ok(r! > 245 && g! > 245 && b! > 245, `${format}: corner ${[r, g, b]}`);
  }
  // Also with a manual quarter-turn.
  const { data } = await displayMaster(await cutOut("png"), { ...options, rotation: 90 });
  const [r, g, b] = await corner(data);
  assert.ok(r! > 245 && g! > 245 && b! > 245);
});

test("an opaque image keeps its colours", async () => {
  const jpeg = await sharp({ create: { width: 30, height: 30, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg({ quality: 100 })
    .toBuffer();
  const { data } = await displayMaster(jpeg, options);
  const [r, g, b] = await corner(data);
  for (const [got, want] of [[r!, 10], [g!, 20], [b!, 30]] as const) assert.ok(Math.abs(got - want) <= 4, `${got} vs ${want}`);
});

test("never enlarges, caps the longest side", async () => {
  const big = await sharp({ create: { width: 300, height: 100, channels: 3, background: "#808080" } }).png().toBuffer();
  const { info } = await displayMaster(big, { ...options, maxDimension: 150 });
  assert.equal(info.width, 150);
  assert.equal(info.height, 50);
  const { info: small } = await displayMaster(big, options);
  assert.equal(small.width, 300);
});

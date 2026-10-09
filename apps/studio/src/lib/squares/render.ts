import sharp from "sharp";
import { FILL, LOW_OBJECT_DROP, MARGIN_BOTTOM, MARGIN_TOP, SHADOW_MARGIN, SQUARE_PX, type Box, type ObjectSquare, type PhotographAnalysis } from "./constants";

// One render at a time, nothing cached between them: the sync runs inside a
// function with a fixed memory ceiling and renders a batch in sequence.
sharp.cache(false);
sharp.concurrency(1);

/* ------------------------------------------------------------------------ */
/* Decoding                                                                 */
/* ------------------------------------------------------------------------ */

type Raw = { data: Uint8Array; width: number; height: number };

/** Decode to an 8-bit sRGB RGB working copy no larger than `max` on the long side. */
/** The photograph's size as displayed: EXIF orientation 5 to 8 swaps the stored sides. */
async function orientedSize(input: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(input, { limitInputPixels: 100_000_000 }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("Image has no size");
  const swap = (meta.orientation ?? 1) >= 5;
  return { width: swap ? h : w, height: swap ? w : h };
}

async function decode(input: Buffer, max: number, blur = 0) {
  const base = sharp(input, { limitInputPixels: 100_000_000 }).autoOrient().toColorspace("srgb").removeAlpha();
  const { width: sourceWidth, height: sourceHeight } = await orientedSize(input);
  const scale = Math.min(1, max / Math.max(sourceWidth, sourceHeight));
  let pipe = base.resize({
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    fit: "fill",
  });
  if (blur > 0) pipe = pipe.blur(blur);
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });
  const raw: Raw = { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
  return { raw, scale, sourceWidth, sourceHeight };
}

/* ------------------------------------------------------------------------ */
/* The backdrop model                                                       */
/* ------------------------------------------------------------------------ */

/**
 * The backdrop as seen along each edge: one RGB colour per row for the left
 * and right edges, one per column for the top and bottom. Built from the
 * median of a thin band, so the subject touching the band only nudges it;
 * rows and columns the subject clearly occupies are then bridged from their
 * neighbours and the whole run smoothed.
 */
type EdgeModel = {
  left: Float32Array;
  right: Float32Array;
  top: Float32Array;
  bottom: Float32Array;
  band: number;
};

/** Darker than the backdrop in every channel, neutral, and not deep: a cast shadow rather than the subject. */
function shadowLike(r: number, g: number, b: number, est: Float32Array): boolean {
  if (r > est[0]! + 2 || g > est[1]! + 2 || b > est[2]! + 2) return false;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (chroma > 14) return false;
  const depth = 0.299 * (est[0]! - r) + 0.587 * (est[1]! - g) + 0.114 * (est[2]! - b);
  return depth <= 90;
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function edgeRun(raw: Raw, band: number, side: "left" | "right" | "top" | "bottom"): Float32Array {
  const { data, width, height } = raw;
  const along = side === "left" || side === "right" ? height : width;
  const out = new Float32Array(along * 3);
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let i = 0; i < along; i++) {
    r.length = g.length = b.length = 0;
    for (let j = 0; j < band; j++) {
      let x: number, y: number;
      if (side === "left") { x = j; y = i; }
      else if (side === "right") { x = width - 1 - j; y = i; }
      else if (side === "top") { x = i; y = j; }
      else { x = i; y = height - 1 - j; }
      const p = (y * width + x) * 3;
      r.push(data[p]!); g.push(data[p + 1]!); b.push(data[p + 2]!);
    }
    out[i * 3] = median(r); out[i * 3 + 1] = median(g); out[i * 3 + 2] = median(b);
  }
  return out;
}

/** Box-smooth an RGB run in place over ±radius samples, skipping nothing. */
function smoothRun(run: Float32Array, radius: number): Float32Array {
  const n = run.length / 3;
  const out = new Float32Array(run.length);
  for (let c = 0; c < 3; c++) {
    let acc = 0, count = 0;
    // sliding window
    for (let i = -radius; i < n; i++) {
      const add = i + radius;
      if (add < n) { acc += run[add * 3 + c]!; count++; }
      const drop = i - radius - 1;
      if (drop >= 0) { acc -= run[drop * 3 + c]!; count--; }
      if (i >= 0) out[i * 3 + c] = acc / count;
    }
  }
  return out;
}

/** Replace flagged samples by linear interpolation between their valid neighbours. */
function bridgeRun(run: Float32Array, bad: Uint8Array): Float32Array {
  const n = bad.length;
  const out = new Float32Array(run);
  let i = 0;
  while (i < n) {
    if (!bad[i]) { i++; continue; }
    let j = i;
    while (j < n && bad[j]) j++;
    const a = i - 1, b = j; // valid neighbours, or off the ends
    for (let k = i; k < j; k++) {
      for (let c = 0; c < 3; c++) {
        const va = a >= 0 ? run[a * 3 + c]! : b < n ? run[b * 3 + c]! : 128;
        const vb = b < n ? run[b * 3 + c]! : va;
        const t = a >= 0 && b < n ? (k - a) / (b - a) : 0;
        out[k * 3 + c] = va + (vb - va) * t;
      }
    }
    i = j;
  }
  return out;
}

/** Deviation of one sample of a run from its smoothed neighbourhood (max over channels). */
function runOutliers(run: Float32Array, radius: number, threshold: number): Uint8Array {
  const n = run.length / 3;
  const smooth = smoothRun(run, radius);
  const bad = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(run[i * 3 + c]! - smooth[i * 3 + c]!));
    if (d > threshold) bad[i] = 1;
  }
  return bad;
}

/**
 * Scans and tight crops often carry a thin white or black line along an
 * edge. Count such lines on each side (in working pixels) so the model and
 * the render both ignore them.
 */
export type Insets = { left: number; top: number; right: number; bottom: number };

/** The median colour of one line of pixels along an edge, `index` lines in from it. */
function lineColour(raw: Raw, side: keyof Insets, index: number): [number, number, number] {
  const { data, width, height } = raw;
  const along = side === "left" || side === "right" ? height : width;
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const step = Math.max(1, Math.round(along / 200));
  for (let i = 0; i < along; i += step) {
    let x: number, y: number;
    if (side === "left") { x = index; y = i; }
    else if (side === "right") { x = width - 1 - index; y = i; }
    else if (side === "top") { x = i; y = index; }
    else { x = i; y = height - 1 - index; }
    const p = (y * width + x) * 3;
    r.push(data[p]!); g.push(data[p + 1]!); b.push(data[p + 2]!);
  }
  return [median(r), median(g), median(b)];
}

function colourGap(a: [number, number, number], b: [number, number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** Lines of the strip, counted from the photograph's edge inward, that differ from the interior. */
function countEdgeLines(strip: Raw, side: keyof Insets, limit: number): number {
  // The interior reference: lines just past the candidate band, per channel,
  // so a coloured line (a scanner's yellow edge) counts as much as a white one.
  const refs = [limit, limit + 1, limit + 2, limit + 3].map((i) => lineColour(strip, side, i));
  const ref: [number, number, number] = [median(refs.map((c) => c[0])), median(refs.map((c) => c[1])), median(refs.map((c) => c[2]))];
  let n = 0;
  for (let i = 0; i < limit; i++) {
    if (colourGap(lineColour(strip, side, i), ref) > 24) n = i + 1;
    else if (n < i) break;
  }
  return n;
}

/**
 * Edge lines are a pixel or two wide, so they are looked for on the
 * photograph at full size: a thin strip along each edge, read as displayed.
 */
async function findInsets(input: Buffer, width: number, height: number): Promise<Insets> {
  const limit = Math.max(2, Math.min(12, Math.round(0.01 * Math.min(width, height))));
  const depth = limit + 4;
  if (width < 2 * depth + 8 || height < 2 * depth + 8) return { left: 0, top: 0, right: 0, bottom: 0 };
  const strip = async (region: { left: number; top: number; width: number; height: number }): Promise<Raw> => {
    const { data, info } = await sharp(input, { limitInputPixels: 100_000_000 })
      .autoOrient()
      .toColorspace("srgb")
      .removeAlpha()
      .extract(region)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
  };
  const [left, right, top, bottom] = await Promise.all([
    strip({ left: 0, top: 0, width: depth, height }),
    strip({ left: width - depth, top: 0, width: depth, height }),
    strip({ left: 0, top: 0, width, height: depth }),
    strip({ left: 0, top: height - depth, width, height: depth }),
  ]);
  return {
    left: countEdgeLines(left, "left", limit),
    right: countEdgeLines(right, "right", limit),
    top: countEdgeLines(top, "top", limit),
    bottom: countEdgeLines(bottom, "bottom", limit),
  };
}

/** The working copy without its edge lines. */
function cropRaw(raw: Raw, ins: Insets): Raw {
  const width = raw.width - ins.left - ins.right;
  const height = raw.height - ins.top - ins.bottom;
  if (width < 8 || height < 8 || (ins.left === 0 && ins.top === 0 && ins.right === 0 && ins.bottom === 0)) return raw;
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const src = ((y + ins.top) * raw.width + ins.left) * 3;
    data.set(raw.data.subarray(src, src + width * 3), y * width * 3);
  }
  return { data, width, height };
}

type EdgeOccupied = { left: Uint8Array; right: Uint8Array; top: Uint8Array; bottom: Uint8Array };

function buildEdgeModel(raw: Raw, band: number, occupied?: EdgeOccupied): EdgeModel {
  const radius = Math.max(3, Math.round(0.02 * Math.max(raw.width, raw.height)));
  const make = (side: "left" | "right" | "top" | "bottom") => {
    const run = edgeRun(raw, band, side);
    const bad = runOutliers(run, radius * 3, 12);
    // Where the subject itself sits in the border band, the band says nothing about the backdrop.
    const occ = occupied?.[side];
    if (occ) for (let i = 0; i < bad.length; i++) if (occ[i]) bad[i] = 1;
    return smoothRun(bridgeRun(run, bad), radius);
  };
  return { left: make("left"), right: make("right"), top: make("top"), bottom: make("bottom"), band };
}

/** The backdrop colour the model predicts at a pixel: the edge runs blended by position. */
function modelAt(m: EdgeModel, x: number, y: number, width: number, height: number, out: Float32Array) {
  const u = width > 1 ? x / (width - 1) : 0;
  const v = height > 1 ? y / (height - 1) : 0;
  const yi = Math.min(height - 1, Math.max(0, Math.round(y))) * 3;
  const xi = Math.min(width - 1, Math.max(0, Math.round(x))) * 3;
  // The nearer pair of edges counts for more: beside the left edge the
  // left/right runs decide, below the top edge the top/bottom runs do, and
  // in a corner both have a say.
  const wH = Math.min(v, 1 - v) + 0.02;
  const wV = Math.min(u, 1 - u) + 0.02;
  for (let c = 0; c < 3; c++) {
    const h = m.left[yi + c]! * (1 - u) + m.right[yi + c]! * u;
    const vv = m.top[xi + c]! * (1 - v) + m.bottom[xi + c]! * v;
    out[c] = (h * wH + vv * wV) / (wH + wV);
  }
}

/* ------------------------------------------------------------------------ */
/* Analysis                                                                 */
/* ------------------------------------------------------------------------ */

const WORK_PX = 1000;

type Analysis = PhotographAnalysis & {
  model: EdgeModel;
  threshold: number;
  workScale: number;
  work: Raw;
  /** Edge lines to ignore, in source pixels. */
  insets: Insets;
};

/**
 * Read the photograph: is there a plain backdrop around a subject, and where
 * is the subject? `flatHint` says the catalogue calls this a painting, print,
 * drawing or the like: a pale, even border is then taken for the work's own
 * paper or mount rather than a backdrop.
 */
async function analyse(input: Buffer, flatHint: boolean): Promise<Analysis> {
  const { width: fullW, height: fullH } = await orientedSize(input);
  const insets = await findInsets(input, fullW, fullH);
  const { raw: whole, scale } = await decode(input, WORK_PX);
  const { raw: wholeSoft } = await decode(input, WORK_PX, 1.2);
  const insetsW: Insets = {
    left: Math.ceil(insets.left * scale),
    top: Math.ceil(insets.top * scale),
    right: Math.ceil(insets.right * scale),
    bottom: Math.ceil(insets.bottom * scale),
  };
  const work = cropRaw(whole, insetsW);
  const soft = cropRaw(wholeSoft, insetsW);
  const { width, height } = work;
  const band = Math.max(4, Math.round(0.02 * Math.min(width, height)));

  // Residual noise of the border band against the model (robust: MAD).
  const est = new Float32Array(3);
  const measureBand = (model: EdgeModel) => {
    const residuals: number[] = [];
    let lum = 0, lumN = 0;
    const sampleBand = (x: number, y: number) => {
      modelAt(model, x, y, width, height, est);
      const p = (y * width + x) * 3;
      const d = Math.max(Math.abs(work.data[p]! - est[0]!), Math.abs(work.data[p + 1]! - est[1]!), Math.abs(work.data[p + 2]! - est[2]!));
      residuals.push(d);
      lum += 0.299 * work.data[p]! + 0.587 * work.data[p + 1]! + 0.114 * work.data[p + 2]!;
      lumN++;
    };
    const step = Math.max(1, Math.round(Math.max(width, height) / 400));
    for (let y = 0; y < height; y += step) for (let j = 0; j < band; j++) { sampleBand(j, y); sampleBand(width - 1 - j, y); }
    for (let x = 0; x < width; x += step) for (let j = 0; j < band; j++) { sampleBand(x, j); sampleBand(x, height - 1 - j); }
    const noise = median(residuals) * 1.4826;
    return { noise, luminance: lumN ? lum / lumN : 0, threshold: Math.min(48, Math.max(14, 4 * noise)) };
  };

  // Subject mask on the softened copy; rows and columns that hold enough of
  // it bound the subject. Also counted: where the subject sits in the border
  // band, per row and column, so the model can be rebuilt without it.
  const rows = new Int32Array(height);
  const cols = new Int32Array(width);
  // The body: hits that are not a cast shadow (darker in every channel,
  // neutral, and not deep), so the square can be centred on the thing itself.
  const bodyRows = new Int32Array(height);
  const bodyCols = new Int32Array(width);
  const occupied: EdgeOccupied = { left: new Uint8Array(height), right: new Uint8Array(height), top: new Uint8Array(width), bottom: new Uint8Array(width) };
  let bandTouched = 0, bandCount = 0;
  const maskPass = (model: EdgeModel, threshold: number) => {
    rows.fill(0); cols.fill(0); bodyRows.fill(0); bodyCols.fill(0);
    const hitsL = new Int32Array(height), hitsR = new Int32Array(height), hitsT = new Int32Array(width), hitsB = new Int32Array(width);
    bandTouched = 0; bandCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        modelAt(model, x, y, width, height, est);
        const p = (y * width + x) * 3;
        const r = soft.data[p]!, g = soft.data[p + 1]!, b = soft.data[p + 2]!;
        const d = Math.max(Math.abs(r - est[0]!), Math.abs(g - est[1]!), Math.abs(b - est[2]!));
        const hit = d > threshold;
        if (hit) {
          rows[y]!++; cols[x]!++;
          if (!shadowLike(r, g, b, est)) { bodyRows[y]!++; bodyCols[x]!++; }
        }
        const inBand = x < band || x >= width - band || y < band || y >= height - band;
        if (inBand) { bandCount++; if (hit) bandTouched++; }
        if (hit) {
          if (x < band) hitsL[y]!++;
          if (x >= width - band) hitsR[y]!++;
          if (y < band) hitsT[x]!++;
          if (y >= height - band) hitsB[x]!++;
        }
      }
    }
    const half = Math.max(1, Math.floor(band / 2));
    let any = false;
    for (let y = 0; y < height; y++) { occupied.left[y] = hitsL[y]! >= half ? 1 : 0; occupied.right[y] = hitsR[y]! >= half ? 1 : 0; any ||= !!(occupied.left[y] || occupied.right[y]); }
    for (let x = 0; x < width; x++) { occupied.top[x] = hitsT[x]! >= half ? 1 : 0; occupied.bottom[x] = hitsB[x]! >= half ? 1 : 0; any ||= !!(occupied.top[x] || occupied.bottom[x]); }
    return any;
  };

  let model = buildEdgeModel(work, band);
  let { noise, luminance, threshold } = measureBand(model);
  if (maskPass(model, threshold)) {
    // The subject reaches the border: model the backdrop from the rest of it.
    model = buildEdgeModel(work, band, occupied);
    ({ noise, luminance, threshold } = measureBand(model));
    maskPass(model, threshold);
  }
  const minRow = Math.max(3, Math.round(0.004 * width));
  const minCol = Math.max(3, Math.round(0.004 * height));
  const bounds = (rs: Int32Array, cs: Int32Array): Box | null => {
    let top = -1, bottom = -1, left = -1, right = -1;
    for (let y = 0; y < height; y++) if (rs[y]! >= minRow) { if (top < 0) top = y; bottom = y; }
    for (let x = 0; x < width; x++) if (cs[x]! >= minCol) { if (left < 0) left = x; right = x; }
    return top >= 0 && left >= 0 ? { left, top, width: right - left + 1, height: bottom - top + 1 } : null;
  };
  const loose = bounds(rows, cols);
  const found = !!loose;
  const boxW = loose ?? { left: 0, top: 0, width, height };
  // The body is trusted when it is a real part of what was found; a subject
  // that is itself dark and neutral reads as shadow, and then the loose box serves.
  const strict = bounds(bodyRows, bodyCols);
  const bodyW = strict && strict.width * strict.height >= 0.25 * boxW.width * boxW.height ? strict : boxW;

  const touch = bandCount ? bandTouched / bandCount : 1;
  const uniform = noise <= 9;
  const coverage = (boxW.width * boxW.height) / (width * height);
  const paleBorder = luminance > 200;
  // A subject may reach the frame on one or two sides (a tightly framed
  // piece) and still sit on a backdrop. A work the catalogue calls flat is
  // taken as such when its even border is pale (its own mount) or when it
  // fills the frame (its own edge); only a painting set small on a studio
  // backdrop is treated as an object.
  const hasBackdrop = found && uniform && touch <= 0.3 && !(flatHint && (paleBorder || coverage >= 0.6));

  const inv = 1 / scale;
  // Box in source pixels, within the uncropped photograph.
  const toSource = (b: Box): Box => ({
    left: insets.left + Math.round(b.left * inv),
    top: insets.top + Math.round(b.top * inv),
    width: Math.max(1, Math.round(b.width * inv)),
    height: Math.max(1, Math.round(b.height * inv)),
  });
  const box = toSource(boxW);
  const body = toSource(bodyW);
  return {
    hasBackdrop,
    box,
    body,
    width: fullW,
    height: fullH,
    border: { noise: Math.round(noise * 10) / 10, touch: Math.round(touch * 1000) / 1000, luminance: Math.round(luminance), uniform },
    model,
    threshold,
    workScale: scale,
    work,
    insets,
  };
}

/** A finished analysis, handed to renderObjectSquare so the photograph is not read twice. */
export type Analysed = { analysis: PhotographAnalysis; detail: Analysis };

export async function analysePhotograph(input: Buffer, opts: { flatHint?: boolean } = {}): Promise<PhotographAnalysis & { analysed: Analysed }> {
  const a = await analyse(input, !!opts.flatHint);
  const analysis = { hasBackdrop: a.hasBackdrop, box: a.box, body: a.body, width: a.width, height: a.height, border: a.border };
  return { ...analysis, analysed: { analysis, detail: a } };
}

/* ------------------------------------------------------------------------ */
/* Rendering                                                                */
/* ------------------------------------------------------------------------ */

/** Deterministic Gaussian noise, so a re-render is identical. */
function gaussian(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return () => {
    const u = Math.max(1e-9, next());
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/**
 * The object square: the subject's larger side fills 80% of the side, the
 * box is centred across and sits with 9% above and 11% below. Where the
 * square reaches past the photograph the backdrop is continued from the
 * edge model, with the photograph's own grain and a soft seam.
 */
export async function renderObjectSquare(
  input: Buffer,
  opts: { flatHint?: boolean; side?: number; analysed?: Analysed } = {},
): Promise<ObjectSquare> {
  const a = opts.analysed?.detail ?? (await analyse(input, !!opts.flatHint));
  const side = opts.side ?? SQUARE_PX;
  const W = a.width, H = a.height;
  const box = a.box;
  const body = a.body;
  // Centred on the body, sized by the body; then widened just enough that
  // the cast shadow keeps a small margin rather than being cut.
  const cx = body.left + body.width / 2;
  const cy = body.top + body.height / 2;
  // Vertical placement: a little below the middle, and lower still for a
  // wide, low object, so it reads as resting rather than floating.
  const aspect = body.height / Math.max(1, body.width);
  const drop = aspect < 1 ? (1 - aspect) * LOW_OBJECT_DROP : 0;
  const centreV = MARGIN_TOP + (1 - MARGIN_TOP - MARGIN_BOTTOM) / 2 + drop;
  let S = Math.max(body.width, body.height) / FILL;
  S = Math.max(
    S,
    (cx - box.left) / (0.5 - SHADOW_MARGIN),
    (box.left + box.width - cx) / (0.5 - SHADOW_MARGIN),
    (cy - box.top) / (centreV - SHADOW_MARGIN),
    (box.top + box.height - cy) / (1 - centreV - SHADOW_MARGIN),
  );
  const canvasLeft = cx - S / 2;
  const canvasTop = cy - centreV * S;
  const k = side / S;

  // The part of the photograph inside the square, at output scale, without
  // any white or black line along the photograph's edges.
  const ins = a.insets;
  const vl = Math.max(ins.left, Math.floor(canvasLeft));
  const vt = Math.max(ins.top, Math.floor(canvasTop));
  const vr = Math.min(W - ins.right, Math.ceil(canvasLeft + S));
  const vb = Math.min(H - ins.bottom, Math.ceil(canvasTop + S));
  const pw = Math.max(1, Math.round((vr - vl) * k));
  const ph = Math.max(1, Math.round((vb - vt) * k));
  const px = Math.round((vl - canvasLeft) * k);
  const py = Math.round((vt - canvasTop) * k);
  const { data: photo } = await sharp(input, { limitInputPixels: 100_000_000 })
    .autoOrient()
    .toColorspace("srgb")
    .removeAlpha()
    .extract({ left: vl, top: vt, width: vr - vl, height: vb - vt })
    .resize({ width: pw, height: ph, fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canvas = new Uint8Array(side * side * 3);
  // Paste the photograph (clipped to the canvas).
  for (let y = 0; y < ph; y++) {
    const cy2 = py + y;
    if (cy2 < 0 || cy2 >= side) continue;
    for (let x = 0; x < pw; x++) {
      const cx2 = px + x;
      if (cx2 < 0 || cx2 >= side) continue;
      const s = (y * pw + x) * 3, d = (cy2 * side + cx2) * 3;
      canvas[d] = photo[s]!; canvas[d + 1] = photo[s + 1]!; canvas[d + 2] = photo[s + 2]!;
    }
  }

  // Backdrop model in output coordinates: a working-copy position for each
  // canvas pixel (the working copy is the photograph less its edge lines).
  const { model, work, workScale } = a;
  const toWorkX = (x: number) => (canvasLeft + x / k - ins.left) * workScale;
  const toWorkY = (y: number) => (canvasTop + y / k - ins.top) * workScale;
  // The backdrop's own drift along each axis, read where the edges are
  // backdrop: the side runs give the vertical trend, the top and bottom
  // runs the horizontal one. Continued outward damped, so a vignette or a
  // lit gradient carries on instead of stopping dead at the seam.
  const spanY = Math.max(2, Math.round(work.height * 0.1));
  const spanX = Math.max(2, Math.round(work.width * 0.1));
  const runSlope = (run: Float32Array, from: number, to: number, c: number) => (run[to * 3 + c]! - run[from * 3 + c]!) / Math.max(1, Math.abs(to - from));
  const trend = (run: Float32Array, length: number, span: number, direction: -1 | 1, c: number) =>
    direction < 0 ? runSlope(run, span, 0, c) : runSlope(run, length - 1 - span, length - 1, c);
  const est = new Float32Array(3);
  const colourAt = (x: number, y: number, out: Float32Array) => {
    const rx = toWorkX(x), ry = toWorkY(y);
    const wx = Math.min(work.width - 1, Math.max(0, rx));
    const wy = Math.min(work.height - 1, Math.max(0, ry));
    modelAt(model, wx, wy, work.width, work.height, out);
    const beyondY = ry < 0 ? ry : ry > work.height - 1 ? ry - (work.height - 1) : 0;
    const beyondX = rx < 0 ? rx : rx > work.width - 1 ? rx - (work.width - 1) : 0;
    for (let c = 0; c < 3; c++) {
      let shift = 0;
      if (beyondY !== 0) {
        const dir = beyondY < 0 ? -1 : 1;
        const slope = (trend(model.left, work.height, spanY, dir, c) + trend(model.right, work.height, spanY, dir, c)) / 2;
        shift += slope * Math.abs(beyondY) * 0.5;
      }
      if (beyondX !== 0) {
        const dir = beyondX < 0 ? -1 : 1;
        const slope = (trend(model.top, work.width, spanX, dir, c) + trend(model.bottom, work.width, spanX, dir, c)) / 2;
        shift += slope * Math.abs(beyondX) * 0.5;
      }
      out[c] = out[c]! + Math.max(-18, Math.min(18, shift));
    }
  };

  // Grain: the photograph's own noise at output scale, measured along its pasted edge.
  const noiseSamples: number[] = [];
  const stepN = Math.max(1, Math.round(Math.max(pw, ph) / 300));
  for (let y = 0; y < ph; y += stepN) {
    for (const x of [0, 1, 2, pw - 3, pw - 2, pw - 1]) {
      if (x < 0 || x >= pw) continue;
      colourAt(px + x, py + y, est);
      const s = (y * pw + x) * 3;
      noiseSamples.push(0.299 * (photo[s]! - est[0]!) + 0.587 * (photo[s + 1]! - est[1]!) + 0.114 * (photo[s + 2]! - est[2]!));
    }
  }
  const grainSigma = Math.min(6, median(noiseSamples.map((v) => Math.abs(v))) * 1.4826);
  const rand = gaussian(0x9e3779b9);

  // What the photograph's edge carries beyond the model: a cast shadow that
  // runs off the frame is continued and fades slowly; anything else at the
  // edge (the subject itself) fades within a few pixels; mere grain is not
  // carried at all. One residual per row for the sides, per column for the
  // top and bottom, smoothed along the edge.
  type Seam = { res: Float32Array; kind: Uint8Array }; // kind: 0 none, 1 shadow, 2 subject
  const SHADOW_REACH = 0.2 * side;
  const SUBJECT_REACH = 0.01 * side;
  const seamOf = (along: number, sample: (i: number, c: number) => number, at: (i: number, out: Float32Array) => void): Seam => {
    const raw = new Float32Array(along * 3);
    for (let i = 0; i < along; i++) {
      at(i, est);
      for (let c = 0; c < 3; c++) raw[i * 3 + c] = sample(i, c) - est[c]!;
    }
    const res = smoothRun(raw, Math.max(2, Math.round(side * 0.004)));
    const kind = new Uint8Array(along);
    const noiseFloor = Math.max(2, 1.5 * grainSigma);
    for (let i = 0; i < along; i++) {
      const r = res[i * 3]!, g = res[i * 3 + 1]!, b = res[i * 3 + 2]!;
      const mag = Math.max(Math.abs(r), Math.abs(g), Math.abs(b));
      if (mag <= noiseFloor) continue;
      at(i, est);
      const pr = est[0]! + r, pg = est[1]! + g, pb = est[2]! + b;
      kind[i] = shadowLike(pr, pg, pb, est) ? 1 : 2;
    }
    return { res, kind };
  };
  const edgeMean = (x0: number, y0: number, dx: number, dy: number, c: number) => {
    // mean of three photo pixels stepping inward from the edge
    let sum = 0, n = 0;
    for (let j = 0; j < 3; j++) {
      const x = x0 + dx * j, y = y0 + dy * j;
      if (x < 0 || x >= pw || y < 0 || y >= ph) break;
      sum += photo[(y * pw + x) * 3 + c]!; n++;
    }
    return n ? sum / n : 0;
  };
  const seamL = px > 0 ? seamOf(ph, (i, c) => edgeMean(0, i, 1, 0, c), (i, out) => colourAt(px, py + i, out)) : null;
  const seamR = px + pw < side ? seamOf(ph, (i, c) => edgeMean(pw - 1, i, -1, 0, c), (i, out) => colourAt(px + pw - 1, py + i, out)) : null;
  const seamT = py > 0 ? seamOf(pw, (i, c) => edgeMean(i, 0, 0, 1, c), (i, out) => colourAt(px + i, py, out)) : null;
  const seamB = py + ph < side ? seamOf(pw, (i, c) => edgeMean(i, ph - 1, 0, -1, c), (i, out) => colourAt(px + i, py + ph - 1, out)) : null;
  const carry = (seam: Seam | null, i: number, dist: number, out: Float32Array) => {
    if (!seam) return;
    const j = Math.min(seam.res.length / 3 - 1, Math.max(0, i));
    const kind = seam.kind[j]!;
    if (!kind) return;
    const w = Math.exp(-dist / (kind === 1 ? SHADOW_REACH : SUBJECT_REACH));
    for (let c = 0; c < 3; c++) out[c] = out[c]! + seam.res[j * 3 + c]! * w;
  };

  // Fill everything outside the photograph.
  const inPhoto = (x: number, y: number) => x >= px && x < px + pw && y >= py && y < py + ph;
  const carried = new Float32Array(3);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (inPhoto(x, y)) continue;
      colourAt(x, y, est);
      // Distance past each edge of the photograph (0 when not beyond it).
      const dl = px - x, dr = x - (px + pw - 1), dt = py - y, db = y - (py + ph - 1);
      carried.set(est);
      if (dl > 0 && dr <= 0) carry(seamL, y - py, dl + Math.max(0, dt, db), carried);
      if (dr > 0 && dl <= 0) carry(seamR, y - py, dr + Math.max(0, dt, db), carried);
      if (dt > 0 && db <= 0) carry(seamT, x - px, dt + Math.max(0, dl, dr), carried);
      if (db > 0 && dt <= 0) carry(seamB, x - px, db + Math.max(0, dl, dr), carried);
      const n = grainSigma > 0 ? rand() * grainSigma : 0;
      const d = (y * side + x) * 3;
      canvas[d] = Math.max(0, Math.min(255, Math.round(carried[0]! + n)));
      canvas[d + 1] = Math.max(0, Math.min(255, Math.round(carried[1]! + n)));
      canvas[d + 2] = Math.max(0, Math.min(255, Math.round(carried[2]! + n)));
    }
  }

  // Soften the seam: inside the photograph, backdrop-like pixels near an edge
  // that meets synthesised backdrop ease towards the model colour.
  const feather = Math.max(6, Math.round(0.015 * side));
  const tol = a.threshold * 1.5;
  const carriedAt = (seam: Seam | null, i: number) => !!seam && seam.kind[Math.min(seam.kind.length - 1, Math.max(0, i))]! !== 0;
  for (let y = 0; y < ph; y++) {
    const cy2 = py + y;
    if (cy2 < 0 || cy2 >= side) continue;
    for (let x = 0; x < pw; x++) {
      const cx2 = px + x;
      if (cx2 < 0 || cx2 >= side) continue;
      // Where the edge's own shadow or subject is carried on outside, the
      // inside is left as photographed.
      let dist = Infinity;
      if (seamL && !carriedAt(seamL, y)) dist = Math.min(dist, x);
      if (seamR && !carriedAt(seamR, y)) dist = Math.min(dist, pw - 1 - x);
      if (seamT && !carriedAt(seamT, x)) dist = Math.min(dist, y);
      if (seamB && !carriedAt(seamB, x)) dist = Math.min(dist, ph - 1 - y);
      if (dist >= feather) continue;
      const d = (cy2 * side + cx2) * 3;
      colourAt(cx2, cy2, est);
      const diff = Math.max(Math.abs(canvas[d]! - est[0]!), Math.abs(canvas[d + 1]! - est[1]!), Math.abs(canvas[d + 2]! - est[2]!));
      if (diff > tol) continue; // the subject itself: leave it
      const t = 1 - dist / feather;
      const w = t * t * 0.85;
      for (let c = 0; c < 3; c++) canvas[d + c] = Math.round(canvas[d + c]! * (1 - w) + est[c]! * w);
    }
  }

  const square = await sharp(Buffer.from(canvas.buffer, canvas.byteOffset, canvas.byteLength), { raw: { width: side, height: side, channels: 3 } })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return {
    square,
    box,
    canvas: { left: Math.round(canvasLeft), top: Math.round(canvasTop), side: Math.round(S) },
    sourceWidth: W,
    sourceHeight: H,
  };
}

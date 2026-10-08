/**
 * pico: a pixel-intensity-comparison face detector (Nenad Markus, MIT).
 * Adapted from https://github.com/nenadmarkus/picojs with types and without
 * the browser globals; the algorithm is unchanged. Detections are
 * [row, column, size, score] in pixels of the grayscale image handed in.
 */

export type GrayImage = { pixels: Uint8Array; nrows: number; ncols: number; ldim: number };
export type Detection = [row: number, col: number, size: number, score: number];
export type Classifier = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;

export function unpackCascade(bytes: Uint8Array): Classifier {
  const dview = new DataView(new ArrayBuffer(4));
  const int32At = (p: number) => {
    dview.setUint8(0, bytes[p]!);
    dview.setUint8(1, bytes[p + 1]!);
    dview.setUint8(2, bytes[p + 2]!);
    dview.setUint8(3, bytes[p + 3]!);
    return dview.getInt32(0, true);
  };
  const float32At = (p: number) => {
    dview.setUint8(0, bytes[p]!);
    dview.setUint8(1, bytes[p + 1]!);
    dview.setUint8(2, bytes[p + 2]!);
    dview.setUint8(3, bytes[p + 3]!);
    return dview.getFloat32(0, true);
  };
  // The first 8 bytes hold the cascade version and training data.
  let p = 8;
  const tdepth = int32At(p);
  p += 4;
  const ntrees = int32At(p);
  p += 4;
  const nodes = 2 ** tdepth;
  const tcodesList: number[] = [];
  const tpredsList: number[] = [];
  const threshList: number[] = [];
  for (let t = 0; t < ntrees; t++) {
    tcodesList.push(0, 0, 0, 0);
    for (let i = 0; i < 4 * nodes - 4; i++) tcodesList.push(bytes[p + i]!);
    p += 4 * nodes - 4;
    for (let i = 0; i < nodes; i++) {
      tpredsList.push(float32At(p));
      p += 4;
    }
    threshList.push(float32At(p));
    p += 4;
  }
  const tcodes = new Int8Array(tcodesList);
  const tpreds = new Float32Array(tpredsList);
  const thresh = new Float32Array(threshList);

  return function classifyRegion(r, c, s, pixels, ldim) {
    r = 256 * r;
    c = 256 * c;
    let root = 0;
    let o = 0.0;
    for (let i = 0; i < ntrees; i++) {
      let idx = 1;
      // Typed-array reads inside the cascade are always in range; the
      // non-null assertions keep the inner loop free of checks.
      for (let j = 0; j < tdepth; j++) {
        const a = pixels[((r + tcodes[root + 4 * idx + 0]! * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1]! * s) >> 8)]!;
        const b = pixels[((r + tcodes[root + 4 * idx + 2]! * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3]! * s) >> 8)]!;
        idx = 2 * idx + (a <= b ? 1 : 0);
      }
      o += tpreds[nodes * i + idx - nodes]!;
      if (o <= thresh[i]!) return -1;
      root += 4 * nodes;
    }
    return o - thresh[ntrees - 1]!;
  };
}

export function runCascade(
  image: GrayImage,
  classify: Classifier,
  params: { shiftfactor: number; minsize: number; maxsize: number; scalefactor: number },
): Detection[] {
  const { pixels, nrows, ncols, ldim } = image;
  const detections: Detection[] = [];
  let scale = params.minsize;
  while (scale <= params.maxsize) {
    const step = Math.max(params.shiftfactor * scale, 1) >> 0;
    const offset = (scale / 2 + 1) >> 0;
    for (let r = offset; r <= nrows - offset; r += step) {
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classify(r, c, scale, pixels, ldim);
        if (q > 0) detections.push([r, c, scale, q]);
      }
    }
    scale *= params.scalefactor;
  }
  return detections;
}

/** Non-maximum suppression: overlapping detections merge into one, scores add up. */
export function clusterDetections(dets: Detection[], iouThreshold: number): Detection[] {
  dets = [...dets].sort((a, b) => b[3] - a[3]);
  const iou = (d1: Detection, d2: Detection) => {
    const [r1, c1, s1] = d1;
    const [r2, c2, s2] = d2;
    const overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
    const overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
    return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
  };
  const assigned = new Array<boolean>(dets.length).fill(false);
  const clusters: Detection[] = [];
  for (let i = 0; i < dets.length; i++) {
    if (assigned[i]) continue;
    let r = 0, c = 0, s = 0, q = 0, n = 0;
    for (let j = i; j < dets.length; j++) {
      const d = dets[j]!;
      if (iou(dets[i]!, d) > iouThreshold) {
        assigned[j] = true;
        r += d[0];
        c += d[1];
        s += d[2];
        q += d[3];
        n++;
      }
    }
    clusters.push([r / n, c / n, s / n, q]);
  }
  return clusters;
}

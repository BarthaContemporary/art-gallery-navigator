/*
 * Placeholder pictures for the storage mock, drawn and PNG-encoded here so
 * the preview needs no image library. Each path always draws the same
 * picture: the hash of the path picks the scene (an object on a studio
 * backdrop, a flat work, a basket, a room shot), the tones and the shape.
 * Flat fills only, so the files stay small.
 */

import zlib from "node:zlib";
import crypto from "node:crypto";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function seeded(str) {
  const h = crypto.createHash("sha1").update(str).digest();
  let i = 0;
  return () => h[i++ % h.length] / 255;
}

const BACKDROPS = [
  [236, 234, 229],
  [228, 226, 222],
  [242, 240, 236],
  [222, 224, 226],
  [232, 228, 220],
];
const OBJECT_TONES = [
  [92, 64, 44], // bamboo, dark
  [150, 112, 70], // bamboo, light
  [58, 62, 66], // iron
  [120, 40, 30], // lacquer red
  [30, 30, 32], // black lacquer
  [176, 160, 132], // stoneware
  [84, 104, 96], // celadon
  [140, 90, 50], // bronze
];
const PAPER = [
  [238, 228, 205],
  [224, 206, 170],
  [214, 190, 150],
];
const PIGMENTS = [
  [176, 52, 36],
  [32, 58, 110],
  [210, 160, 40],
  [24, 24, 24],
  [60, 110, 70],
];

/**
 * Draw the scene for `key` at width × height. `kind` forces a scene:
 * object | flat | basket | room | portrait | page.
 */
export function drawPlaceholder(key, width, height, kind) {
  const rnd = seeded(key);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
  const scene = kind ?? pick(["object", "object", "flat", "basket", "room", "flat"]);
  const buf = Buffer.alloc(width * height * 3);
  const set = (x, y, c) => {
    const i = (y * width + x) * 3;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
  };
  const fill = (x0, y0, x1, y1, c) => {
    for (let y = Math.max(0, y0 | 0); y < Math.min(height, y1 | 0); y++)
      for (let x = Math.max(0, x0 | 0); x < Math.min(width, x1 | 0); x++) set(x, y, c);
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.max(0, (cy - ry) | 0); y < Math.min(height, cy + ry); y++) {
      const dy = (y - cy) / ry;
      const span = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      for (let x = Math.max(0, (cx - span) | 0); x < Math.min(width, cx + span); x++) set(x, y, c);
    }
  };
  const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));

  if (scene === "page") {
    fill(0, 0, width, height, [250, 250, 248]);
    const m = width * 0.1;
    for (let i = 0; i < 18; i++) {
      const y = height * 0.12 + i * height * 0.04;
      fill(m, y, width - m - rnd() * width * 0.25, y + Math.max(2, height * 0.008), [190, 190, 186]);
    }
    return encodePng(width, height, buf);
  }

  if (scene === "portrait") {
    const grey = 200 + Math.floor(rnd() * 30);
    fill(0, 0, width, height, [grey, grey, grey]);
    const skin = 120 + Math.floor(rnd() * 60);
    ellipse(width * (0.42 + rnd() * 0.16), height * 0.38, width * 0.17, height * 0.15, [skin, skin, skin]);
    ellipse(width * 0.5, height * 1.02, width * 0.42, height * 0.42, [60, 60, 62]);
    return encodePng(width, height, buf);
  }

  if (scene === "room") {
    const wall = shade(pick(BACKDROPS), 0.92);
    fill(0, 0, width, height, wall);
    const tableTop = height * (0.62 + rnd() * 0.08);
    fill(0, tableTop, width, height, [96, 70, 50]);
    fill(0, tableTop, width, tableTop + height * 0.015, [120, 92, 66]);
    const tone = pick(OBJECT_TONES);
    const cx = width * (0.35 + rnd() * 0.3);
    const h = height * (0.3 + rnd() * 0.2);
    ellipse(cx, tableTop - h * 0.45, width * 0.12, h * 0.45, tone);
    fill(cx - width * 0.04, tableTop - h * 1.0, cx + width * 0.04, tableTop - h * 0.8, shade(tone, 0.85));
    return encodePng(width, height, buf);
  }

  if (scene === "flat") {
    // A flat work cropped to its edges: paper ground with blocks of pigment.
    const paper = pick(PAPER);
    fill(0, 0, width, height, paper);
    const n = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const c = pick(PIGMENTS);
      const x = rnd() * width * 0.8;
      const y = rnd() * height * 0.8;
      if (rnd() > 0.5) ellipse(x + width * 0.1, y + height * 0.1, width * (0.05 + rnd() * 0.15), height * (0.05 + rnd() * 0.12), c);
      else fill(x, y, x + width * (0.05 + rnd() * 0.25), y + height * (0.02 + rnd() * 0.1), c);
    }
    // a thin border, as on a mounted sheet
    const b = Math.max(2, Math.round(width * 0.01));
    fill(0, 0, width, b, shade(paper, 0.85));
    fill(0, height - b, width, height, shade(paper, 0.85));
    fill(0, 0, b, height, shade(paper, 0.85));
    fill(width - b, 0, width, height, shade(paper, 0.85));
    return encodePng(width, height, buf);
  }

  // object or basket on a seamless studio backdrop, lit from above
  const bg = pick(BACKDROPS);
  for (let y = 0; y < height; y++) {
    const f = 1.02 - (y / height) * 0.08;
    const c = shade(bg, f);
    for (let x = 0; x < width; x++) set(x, y, c);
  }
  const tone = pick(OBJECT_TONES);
  const cx = width * (0.45 + rnd() * 0.1);
  const base = height * 0.86;
  const h = height * (0.45 + rnd() * 0.25);
  const w = width * (0.18 + rnd() * 0.18);
  // soft cast shadow
  ellipse(cx + w * 0.15, base, w * 1.1, height * 0.025, shade(bg, 0.82));
  if (scene === "basket") {
    ellipse(cx, base - h * 0.35, w * 1.15, h * 0.35, tone);
    for (let i = 0; i < 9; i++) {
      const y = base - h * 0.7 + (i * h * 0.7) / 9;
      fill(cx - w * 1.0, y, cx + w * 1.0, y + Math.max(1, height * 0.004), shade(tone, 0.7));
    }
    // handle
    for (let t = 0; t < 180; t++) {
      const a = (Math.PI * t) / 180;
      const x = Math.round(cx + Math.cos(a) * w * 0.9);
      const y = Math.round(base - h * 0.7 - Math.sin(a) * h * 0.35);
      fill(x - 3, y - 3, x + 3, y + 3, shade(tone, 0.8));
    }
  } else {
    ellipse(cx, base - h * 0.38, w, h * 0.38, tone);
    fill(cx - w * 0.28, base - h * 0.95, cx + w * 0.28, base - h * 0.6, shade(tone, 0.9));
    ellipse(cx, base - h * 0.95, w * 0.36, h * 0.03, shade(tone, 0.75));
    ellipse(cx - w * 0.35, base - h * 0.5, w * 0.12, h * 0.12, shade(tone, 1.25));
  }
  return encodePng(width, height, buf);
}

/** A one-page PDF with a title line, for document previews. */
export function placeholderPdf(title) {
  const text = String(title).replace(/[()\\]/g, "").slice(0, 80);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 14 Tf 60 780 Td (${text}) Tj ET\nBT /F1 10 Tf 60 760 Td (Preview document, fictional data) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

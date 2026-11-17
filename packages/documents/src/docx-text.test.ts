// node --test packages/documents/src/docx-text.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { Document, Packer, Paragraph } from "docx";
import { splitLines, textRuns } from "./docx-text.ts";

/** word/document.xml out of a .docx (a zip): central directory, then inflate. */
function documentXml(zip: Buffer): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, "zip end record");
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === "word/document.xml") {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const raw = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("word/document.xml not found");
}

async function xmlFor(text: string, options = {}): Promise<string> {
  const doc = new Document({ sections: [{ children: [new Paragraph({ children: textRuns(text, options) })] }] });
  return documentXml(await Packer.toBuffer(doc));
}

test("splits on LF, CRLF and CR, keeping blank lines", () => {
  assert.deepEqual(splitLines("a\nb\r\nc\rd"), ["a", "b", "c", "d"]);
  assert.deepEqual(splitLines("a\n\nb"), ["a", "", "b"]);
  assert.deepEqual(splitLines("one line"), ["one line"]);
});

test("a multi-line description becomes runs with line breaks, not literal newlines", async () => {
  const xml = await xmlFor("First paragraph line.\r\nSecond line.\n\nThird paragraph.", { size: 21, color: "3A3A3A" });
  assert.equal((xml.match(/<w:br\/>/g) ?? []).length, 3);
  assert.ok(!/<w:t[^>]*>[^<]*[\r\n][^<]*<\/w:t>/.test(xml), "no newline inside w:t");
  for (const s of ["First paragraph line.", "Second line.", "Third paragraph."]) assert.ok(xml.includes(s), s);
  // Every run keeps the formatting.
  assert.equal((xml.match(/<w:color w:val="3A3A3A"\/>/g) ?? []).length, 4);
  assert.equal((xml.match(/<w:p>|<w:p /g) ?? []).length, 1, "still one paragraph");
});

test("single-line text is one run without a break", async () => {
  const xml = await xmlFor("Tea bowl", { bold: true });
  assert.equal((xml.match(/<w:br\/>/g) ?? []).length, 0);
  assert.equal((xml.match(/<w:r>/g) ?? []).length, 1);
  assert.equal(textRuns("Tea bowl").length, 1);
});

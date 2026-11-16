// node --test apps/studio/src/lib/newsletter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileNewsletter, personalise, type NewsletterDesign } from "./newsletter.ts";

const ctx = { galleryName: "Joost van den Bergh", galleryAddress: "London" };

function worksGrid(n: number): string {
  const design: NewsletterDesign = {
    blocks: [
      {
        id: "w",
        type: "works",
        items: Array.from({ length: n }, (_, i) => ({
          title: `Work ${i + 1}`,
          maker: "Hamada Shōji",
          url: `https://example.com/w/${i + 1}`,
          imageUrl: `https://img.example/${i + 1}.jpg`,
        })),
      },
    ],
  };
  const html = compileNewsletter(design, ctx);
  const grid = html.match(/<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px -8px 0;">([\s\S]*?)<\/table>/);
  assert.ok(grid, "works grid present");
  return grid[1] ?? "";
}

test("works are laid out two to a row, an odd last one with an empty partner", () => {
  const three = worksGrid(3);
  const rows = three.split("<tr>").slice(1);
  assert.equal(rows.length, 2);
  assert.equal((rows[0]?.match(/<td width="50%" valign="top"/g) ?? []).length, 2);
  assert.ok(rows[1]?.includes("Work 3"));
  assert.ok(rows[1]?.endsWith('<td width="50%"></td></tr>'));
  assert.equal(worksGrid(4).split("<tr>").length - 1, 2);
  assert.equal(worksGrid(1).split("<tr>").length - 1, 1);
});

test("no works, no grid", () => {
  const html = compileNewsletter({ blocks: [{ id: "w", type: "works", items: [] }] }, ctx);
  assert.doesNotMatch(html, /margin:4px -8px 0/);
});

test("work text is escaped and only web links survive", () => {
  const html = compileNewsletter(
    {
      blocks: [
        {
          id: "w",
          type: "works",
          items: [{ title: "</td><td>x", url: "javascript:alert(1)", imageUrl: "data:image/png;base64,AA" }],
        },
      ],
    },
    ctx,
  );
  assert.doesNotMatch(html, /javascript:|data:image/);
  assert.match(html, /&lt;\/td&gt;&lt;td&gt;x/);
});

test("the merge tokens are filled per recipient", () => {
  const html = compileNewsletter({ blocks: [] }, ctx);
  const out = personalise(html, { salutation: "Dear Anna & Tom", unsubscribeUrl: "https://example.com/u/abc" });
  assert.match(out, /Dear Anna &amp; Tom,/);
  assert.match(out, /href="https:\/\/example\.com\/u\/abc"/);
  assert.doesNotMatch(out, /\{\{/);
});

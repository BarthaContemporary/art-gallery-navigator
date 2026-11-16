// node --test apps/studio/src/lib/sanitize-html.test.ts
// The maker profile allow-list, which the maker page now applies on read as
// well as the profile route on save (security review 2026-10, F3).
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the studio's tsconfig (which also checks
// this file) does not allow it, so the import alone is excused.
// @ts-ignore TS5097
import { sanitizeHtml } from "./sanitize-html.ts";

test("keeps the formatting the editor makes", () => {
  const html =
    "<h2>Life</h2><p>Born in <b>Tokyo</b>, <i>shibuichi</i> and <u>shakudō</u>.<br></p>" +
    "<h3>Work</h3><ul><li>one</li></ul><ol><li>two</li></ol><p><strong>s</strong> <em>e</em></p>";
  assert.equal(sanitizeHtml(html), html.replace("<br>", "<br />"));
});

test("drops script, handlers and embedded content in every spelling", () => {
  for (const html of [
    "<img src=x onerror=alert(1)>",
    "<img/src=x/onerror=alert(1)>",
    "<svg onload=alert(1)></svg>",
    "<script>alert(1)</script>",
    "<iframe src=//evil.example></iframe>",
    "<object data=x></object>",
    "<style>p{}</style>",
    "<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
  ]) {
    const out = sanitizeHtml(html);
    assert.doesNotMatch(out, /on\w+=|<script|<img|<svg|<iframe|<object|<style|javascript:/i, `${html} → ${out}`);
  }
  assert.equal(sanitizeHtml('<p onclick="x()" style="color:red" class="c">hi</p>'), "<p>hi</p>");
});

test("links: web and mail only, always with a safe rel", () => {
  assert.equal(
    sanitizeHtml('<a href="https://www.vam.ac.uk/" target="_top">V&amp;A</a>'),
    '<a href="https://www.vam.ac.uk/" rel="noopener noreferrer nofollow">V&amp;A</a>',
  );
  assert.equal(
    sanitizeHtml('<a href="mailto:info@example.com">mail</a>'),
    '<a href="mailto:info@example.com" rel="noopener noreferrer nofollow">mail</a>',
  );
  // A rel of the input's own is replaced, never kept.
  assert.equal(
    sanitizeHtml('<a href="https://example.com/" rel="opener">x</a>'),
    '<a href="https://example.com/" rel="noopener noreferrer nofollow">x</a>',
  );
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java&#x09;script:alert(1)", "data:text/html,x", "//evil.example/"]) {
    assert.doesNotMatch(sanitizeHtml(`<a href="${href}">x</a>`), /href=/, href);
  }
});

test("is stable, so sanitising on read and again on save changes nothing", () => {
  for (const html of [
    "<p>Plain</p>",
    '<p><a href="https://example.com/a?b=1&amp;c=2" title="t">link</a> and <b>bold</b></p>',
    "<p>Fish &amp; chips &lt;3</p><img src=x onerror=alert(1)><p>after</p>",
    "",
    // Block shapes the editor and pastes produce (below).
    "Born.<div>He studied.</div><div><br></div><div>Exhibited.</div>",
    "<div><div>x</div><div>y</div></div>",
    "<div>t<p>u</p></div>",
    "<p><div>x</div></p>",
    "<p>a<h1>T</h1>b</p>",
    "<h1><h2>nested</h2></h1>",
    "<section><h4>Sub</h4><p>x</p></section><table><tr><td>a</td><td>b</td></tr></table>",
  ]) {
    const once = sanitizeHtml(html);
    assert.equal(sanitizeHtml(once), once, html);
  }
});

test("lines typed with Enter keep their breaks (Chrome and Safari's <div>s)", () => {
  // Typing into an empty editor: the first line bare, each later one a <div>.
  assert.equal(
    sanitizeHtml(
      "Born in Kyoto in 1890.<div>He studied under Tanabe Chikuunsai.</div><div><br></div><div>Exhibited at the Teiten from 1929.</div>",
    ),
    "Born in Kyoto in 1890.<div>He studied under Tanabe Chikuunsai.</div><div><br /></div><div>Exhibited at the Teiten from 1929.</div>",
  );
  // Enter after a heading made with the toolbar.
  assert.equal(sanitizeHtml("<h2>Life</h2><div>Born</div>"), "<h2>Life</h2><div>Born</div>");
});

test("Firefox's one <div> per line is kept, and was saved as 'A.B.'", () => {
  assert.equal(sanitizeHtml("<div>A.</div><div>B.</div>"), "<div>A.</div><div>B.</div>");
});

test("a pasted page keeps its block boundaries, with no attributes", () => {
  assert.equal(
    sanitizeHtml(
      '<h1 id="x">Biography</h1><div class="c" style="color:red"><div>one</div><div>two</div></div>' +
        '<blockquote cite="u">said</blockquote><section><h4>Sub</h4><p>x</p></section>' +
        "<table><tr><td>a</td><td>b</td></tr></table>",
    ),
    "<h2>Biography</h2><div><div>one</div><div>two</div></div><blockquote>said</blockquote>" +
      "<div><h3>Sub</h3><p>x</p></div><div>a</div><div>b</div>",
  );
  assert.equal(sanitizeHtml('<div onclick="x()" onmouseover="y()">z</div>'), "<div>z</div>");
});

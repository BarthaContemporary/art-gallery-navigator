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
  ]) {
    const once = sanitizeHtml(html);
    assert.equal(sanitizeHtml(once), once, html);
  }
});

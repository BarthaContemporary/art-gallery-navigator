// node --test apps/web/src/lib/publications.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueLink } from "./publications.ts";

test("an uploaded PDF or a .pdf link is a download; any other link is a page to view", () => {
  assert.deepEqual(catalogueLink({ pdfUrl: "https://cdn.sanity.io/files/x/y/abc.pdf", externalUrl: "https://issuu.com/x" }), {
    href: "https://cdn.sanity.io/files/x/y/abc.pdf",
    label: "Download PDF ↓",
  });
  assert.equal(catalogueLink({ pdfUrl: null, externalUrl: "https://example.org/cat.PDF?dl=1" })?.label, "Download PDF ↓");
  assert.deepEqual(catalogueLink({ pdfUrl: null, externalUrl: "https://issuu.com/jvb/docs/showa" }), {
    href: "https://issuu.com/jvb/docs/showa",
    label: "View catalogue ↗",
  });
  assert.equal(catalogueLink({ pdfUrl: null, externalUrl: "https://example.org/pdf-viewer" })?.label, "View catalogue ↗");
  assert.equal(catalogueLink({ pdfUrl: null, externalUrl: null }), null);
});

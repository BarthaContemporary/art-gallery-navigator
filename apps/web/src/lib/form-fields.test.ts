// node --test apps/web/src/lib/form-fields.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, exactLikePattern, greetingName, OFFER_TOKEN, ONE_LINE, siteLine, typedLine } from "./form-fields.ts";
import { isPrivatePath, plausibleManualSrc } from "./private-paths.ts";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

test("typed single-line fields refuse line breaks and control characters", () => {
  for (const ok of ["Jane Smith", "Flat 2, 10 Duke Street", "+44 20 7839 0000", "SW1Y 6BN", "Sōtatsu 宗達", "O’Brien-Hall"]) {
    assert.ok(ONE_LINE.test(typedLine(ok)), ok);
    assert.equal(typedLine(ok), ok);
  }
  for (const bad of ["Jane\rSmith", "line1\nline2", "a\r\n=HYPERLINK(\"x\")", "nul\u0000", "del\u007f", "vt\u000b", "nel\u0085x", "c1\u009b"]) {
    assert.ok(!ONE_LINE.test(typedLine(bad)), JSON.stringify(bad));
  }
});

test("pasted tabs and line separators in typed fields become spaces", () => {
  assert.equal(typedLine("10 Duke Street\tLondon"), "10 Duke Street London");
  assert.equal(typedLine("ls\u2028ps\u2029"), "ls ps ");
  for (const pasted of ["10 Duke Street\tLondon", "a\u2028b", "a\u2029b"]) {
    assert.ok(ONE_LINE.test(typedLine(pasted)), JSON.stringify(pasted));
  }
});

test("site-built single-line values are tidied, never refused", () => {
  assert.equal(siteLine("HARA Satoshi, Bowl\nwith lid | JVB-123"), "HARA Satoshi, Bowl with lid | JVB-123");
  assert.equal(siteLine("Title \r\n  Maker"), "Title Maker");
  assert.equal(siteLine("a\r\n=HYPERLINK(\"x\")"), "a =HYPERLINK(\"x\")");
  assert.equal(siteLine("\ttabbed\u2028and\u0000nul\u007f "), "tabbed and nul");
  assert.equal(siteLine("Plain title | Code"), "Plain title | Code");
  for (const v of ["x\ny", "x\r\ny", "x\u2029y", "\u0001"]) assert.ok(ONE_LINE.test(siteLine(v)), JSON.stringify(v));
});

test("client IP comes from Vercel's headers, never cf-connecting-ip", () => {
  assert.equal(clientIp(headers({ "x-real-ip": "203.0.113.4", "x-forwarded-for": "198.51.100.1" })), "203.0.113.4");
  assert.equal(clientIp(headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })), "198.51.100.1");
  assert.equal(clientIp(headers({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientIp(headers({ "cf-connecting-ip": "192.0.2.9" })), null);
  assert.equal(clientIp(headers({ "x-real-ip": "not an ip; drop table" })), null);
  assert.equal(clientIp(headers({})), null);
});

test("greeting name is one plain word or nothing", () => {
  assert.equal(greetingName("Jane Smith"), "Jane");
  assert.equal(greetingName("  Hélène  Dupont "), "Hélène");
  assert.equal(greetingName("O’Brien"), "O’Brien");
  assert.equal(greetingName("宗達"), "宗達");
  assert.equal(greetingName("https://evil.example/claim"), null);
  assert.equal(greetingName("evil.example"), null);
  assert.equal(greetingName("<b>Hi</b>"), null);
  assert.equal(greetingName("Winner!!! Click"), null);
  assert.equal(greetingName("a".repeat(31)), null);
  assert.equal(greetingName("--"), null);
  assert.equal(greetingName(""), null);
  assert.equal(greetingName(null), null);
});

test("exact LIKE pattern escapes every wildcard", () => {
  assert.equal(exactLikePattern("john_smith@example.com"), "john\\_smith@example.com");
  assert.equal(exactLikePattern("a%b*c\\d"), "a\\%b\\*c\\\\d");
  assert.equal(exactLikePattern("plain@example.com"), "plain@example.com");
});

test("offer tokens are plain and bounded", () => {
  assert.ok(OFFER_TOKEN.test("0123456789abcdef0123456789abcdef0123"));
  assert.ok(!OFFER_TOKEN.test("short"));
  assert.ok(!OFFER_TOKEN.test("abc/../def1234"));
  assert.ok(!OFFER_TOKEN.test("abcdefgh; Path=/"));
  assert.ok(!OFFER_TOKEN.test("a".repeat(129)));
});

test("Plausible runs as its manual tracker, or not at all", () => {
  assert.equal(
    plausibleManualSrc("https://analytics.joostvandenbergh.com/js/script.js"),
    "https://analytics.joostvandenbergh.com/js/script.manual.js",
  );
  // Extensions that send events by themselves are left off.
  assert.equal(
    plausibleManualSrc("https://analytics.example.com/js/script.outbound-links.file-downloads.js"),
    "https://analytics.example.com/js/script.manual.js",
  );
  assert.equal(plausibleManualSrc("https://plausible.io/js/plausible.manual.js"), "https://plausible.io/js/plausible.manual.js");
  assert.equal(plausibleManualSrc("/js/script.js"), "/js/script.manual.js");
  assert.equal(plausibleManualSrc("http://localhost:8000/js/script.js"), "http://localhost:8000/js/script.manual.js");
  for (const unknown of ["https://analytics.example.com/js/pa-XyZ123.js", "https://example.com/stats.js", "javascript:alert(1)", "https://a.example/js/script.js?x=1", "", null]) {
    assert.equal(plausibleManualSrc(unknown), null, String(unknown));
  }
});

test("tracking stays off the pages whose address is their key", () => {
  for (const p of ["/o/0123456789abcdef", "/o", "/newsletter/confirm/abc", "/newsletter/confirmed"]) assert.ok(isPrivatePath(p), p);
  for (const p of ["/", "/about", "/artists/hara", "/offers", "/organisations", "/newsletters-archive", null]) assert.ok(!isPrivatePath(p), String(p));
});

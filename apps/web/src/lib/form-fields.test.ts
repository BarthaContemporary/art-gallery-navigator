// node --test apps/web/src/lib/form-fields.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, exactLikePattern, greetingName, OFFER_TOKEN, ONE_LINE } from "./form-fields.ts";
import { isPrivatePath } from "./private-paths.ts";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

test("single-line fields refuse line breaks and control characters", () => {
  for (const ok of ["Jane Smith", "Flat 2, 10 Duke Street", "+44 20 7839 0000", "SW1Y 6BN", "Sōtatsu 宗達", "O’Brien-Hall"]) {
    assert.ok(ONE_LINE.test(ok), ok);
  }
  for (const bad of ["Jane\rSmith", "line1\nline2", "a\r\n=HYPERLINK(\"x\")", "tab\there", "nul\u0000", "del\u007f", "ls\u2028", "ps\u2029"]) {
    assert.ok(!ONE_LINE.test(bad), JSON.stringify(bad));
  }
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

test("tracking stays off the pages whose address is their key", () => {
  for (const p of ["/o/0123456789abcdef", "/o", "/newsletter/confirm/abc", "/newsletter/confirmed"]) assert.ok(isPrivatePath(p), p);
  for (const p of ["/", "/about", "/artists/hara", "/offers", "/organisations", "/newsletters-archive", null]) assert.ok(!isPrivatePath(p), String(p));
});

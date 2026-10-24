// node --test apps/studio/src/app/login/sign-in.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { authServerChecksCaptcha, clientIp, limitAddress, LOGIN_ERRORS, loginErrorFromAuth, loginErrorMessage, SIGN_IN_LIMITS, signInLimits, withinSignInLimits } from "./sign-in.ts";

test("every code has fixed text; anything else shows nothing", () => {
  for (const [code, text] of Object.entries(LOGIN_ERRORS)) assert.equal(loginErrorMessage(code), text);
  for (const junk of [
    "",
    null,
    undefined,
    "Invalid login credentials",
    "Your account is locked. Call +44 20 0000 0000 to unlock it.",
    "toString",
    "__proto__",
    "constructor",
  ]) {
    assert.equal(loginErrorMessage(junk), null, String(junk));
  }
});

test("GoTrue errors map to codes", () => {
  const cases: [Parameters<typeof loginErrorFromAuth>[0], boolean, string][] = [
    [{ code: "invalid_credentials", status: 400, message: "Invalid login credentials" }, false, "credentials"],
    [{ status: 400, message: "Invalid login credentials" }, true, "credentials"],
    [{ code: "over_request_rate_limit", status: 429, message: "Request rate limit reached" }, false, "rate-limited"],
    [{ status: 429, message: "Too many requests" }, true, "rate-limited"],
    [{ code: "captcha_failed", status: 400, message: "captcha protection: request disallowed (invalid-input-response)" }, true, "check-failed"],
    // GoTrue says the same for "no token sent" and "Cloudflare unreachable".
    [{ code: "unexpected_failure", status: 500, message: "captcha verification process failed" }, false, "check-missing"],
    [{ code: "unexpected_failure", status: 500, message: "captcha verification process failed" }, true, "check-unavailable"],
    [{ code: "email_not_confirmed", status: 400, message: "Email not confirmed" }, false, "failed"],
    [{ status: 500, message: "Database error querying schema" }, false, "failed"],
    [{}, false, "failed"],
  ];
  for (const [error, sentToken, want] of cases) {
    const got = loginErrorFromAuth(error, sentToken);
    assert.equal(got, want, JSON.stringify(error));
    assert.ok(loginErrorMessage(got), `${got} has text`);
  }
});

test("the auth-server captcha flag is off unless set to 1 or true", () => {
  assert.equal(authServerChecksCaptcha({}), false);
  for (const off of ["", "0", "false", "no", "off", "2"]) assert.equal(authServerChecksCaptcha({ AUTH_SERVER_CAPTCHA: off }), false, off);
  for (const on of ["1", "true", "TRUE", " 1 "]) assert.equal(authServerChecksCaptcha({ AUTH_SERVER_CAPTCHA: on }), true, on);
});

const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

test("the sender's address comes from Vercel's headers only", () => {
  assert.equal(clientIp(headers({ "x-real-ip": "203.0.113.4", "x-forwarded-for": "198.51.100.1" })), "203.0.113.4");
  assert.equal(clientIp(headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" })), "198.51.100.1");
  assert.equal(clientIp(headers({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientIp(headers({ "cf-connecting-ip": "203.0.113.9" })), null);
  assert.equal(clientIp(headers({ "x-real-ip": "not an ip; drop table" })), null);
  assert.equal(clientIp(headers({})), null);
});

test("IPv6 senders are counted per /64, IPv4 per address", () => {
  assert.equal(limitAddress("203.0.113.4"), "203.0.113.4");
  assert.equal(limitAddress("::ffff:203.0.113.4"), "203.0.113.4");
  const net = "2001:db8:aa:1::/64";
  for (const ip of ["2001:db8:aa:1::1", "2001:0DB8:00AA:0001:ffff:1:2:3", "2001:db8:aa:1:0:0:0:9", " 2001:db8:aa:1:: "]) {
    assert.equal(limitAddress(ip), net, ip);
  }
  assert.notEqual(limitAddress("2001:db8:aa:2::1"), net);
  assert.equal(limitAddress("::1"), "0:0:0:0::/64");
  assert.equal(limitAddress("fe80::"), "fe80:0:0:0::/64");
  // Malformed: counted as written, never thrown on.
  for (const odd of ["1::2::3", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7::8", "64:ff9b::192.0.2.1", "zz::1"]) {
    assert.equal(limitAddress(odd), odd, odd);
  }
});

test("each attempt counts per address, per email and per app; the address and email only as hashes", () => {
  const hash = (v: string) => `h(${v})`;
  assert.deepEqual(signInLimits("studio", "2001:db8:aa:1::7", "  Joost@Example.com ", hash), [
    { key: "login:ip:h(2001:db8:aa:1::/64)", ...SIGN_IN_LIMITS.address },
    { key: "login:email:h(joost@example.com)", ...SIGN_IN_LIMITS.email },
    { key: "login:app:studio", ...SIGN_IN_LIMITS.app },
  ]);
  // Both apps share the address and email counts, not the app count.
  const capture = signInLimits("capture", "2001:db8:aa:1::8", "joost@example.com", hash);
  assert.deepEqual(capture.map((l) => l.key), ["login:ip:h(2001:db8:aa:1::/64)", "login:email:h(joost@example.com)", "login:app:capture"]);
  // No address (local development), no email: those counts are left out.
  assert.deepEqual(signInLimits("capture", null, " ", hash).map((l) => l.key), ["login:app:capture"]);
  for (const l of signInLimits("studio", "203.0.113.4", "a@b.c", (v) => v)) assert.ok(l.key.length <= 300, l.key);
});

test("what both apps pass on stays inside GoTrue's first burst for one address", () => {
  // GoTrue v2.170 lets 30 sign-in or refresh requests through per address
  // before its per-5-minute rate applies (internal/api/options.go, Token
  // limiter SetBurst(30)). Refreshes need some of it.
  assert.ok(2 * SIGN_IN_LIMITS.app.max < 30);
  // One sender alone cannot use up an app's count.
  assert.ok(SIGN_IN_LIMITS.address.max < SIGN_IN_LIMITS.app.max);
  assert.equal(SIGN_IN_LIMITS.address.windowSeconds, SIGN_IN_LIMITS.app.windowSeconds);
});

test("counts are checked in order and stop at the first refusal", async () => {
  const limits = signInLimits("studio", "203.0.113.4", "a@b.c", (v) => v);
  const seen: string[] = [];
  const allow = (refuse: string | null) => async (key: string) => {
    seen.push(key);
    return key !== refuse;
  };
  assert.equal(await withinSignInLimits(limits, allow(null)), true);
  assert.deepEqual(seen, ["login:ip:203.0.113.4", "login:email:a@b.c", "login:app:studio"]);
  seen.length = 0;
  assert.equal(await withinSignInLimits(limits, allow("login:ip:203.0.113.4")), false);
  assert.deepEqual(seen, ["login:ip:203.0.113.4"], "a refused address does not use up the email's or app's count");
  seen.length = 0;
  assert.equal(await withinSignInLimits(limits, allow("login:email:a@b.c")), false);
  assert.deepEqual(seen, ["login:ip:203.0.113.4", "login:email:a@b.c"]);
  // The window and maximum reach the limiter as given.
  const args: [string, number, number][] = [];
  await withinSignInLimits(limits, async (k, w, m) => (args.push([k, w, m]), true));
  assert.deepEqual(args[2], ["login:app:studio", 300, SIGN_IN_LIMITS.app.max]);
});

test("the capture app's copy is identical", () => {
  const here = readFileSync(new URL("./sign-in.ts", import.meta.url), "utf8");
  const capture = readFileSync(new URL("../../../../capture/src/app/login/sign-in.ts", import.meta.url), "utf8");
  assert.equal(capture, here, "apps/capture/src/app/login/sign-in.ts must match apps/studio/src/app/login/sign-in.ts");
});

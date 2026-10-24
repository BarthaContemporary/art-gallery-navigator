// node --test apps/studio/src/app/login/sign-in.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { clientIp, limitAddress, LOGIN_ERRORS, loginErrorFromAuth, loginErrorMessage, runPasswordSignIn, SIGN_IN_LIMITS, signInLimits, withinSignInLimits } from "./sign-in.ts";

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
  const cases: [Parameters<typeof loginErrorFromAuth>[0], string][] = [
    [{ code: "invalid_credentials", status: 400, message: "Invalid login credentials" }, "credentials"],
    [{ status: 400, message: "Invalid login credentials" }, "credentials"],
    [{ code: "over_request_rate_limit", status: 429, message: "Request rate limit reached" }, "rate-limited"],
    [{ status: 429, message: "Too many requests" }, "rate-limited"],
    // The app checks the Cloudflare token itself and signs in with the
    // service-role key, which GoTrue's own check lets through: a captcha
    // refusal means the set-up is wrong, not the visitor.
    [{ code: "captcha_failed", status: 400, message: "captcha protection: request disallowed (invalid-input-response)" }, "failed"],
    [{ code: "unexpected_failure", status: 500, message: "captcha verification process failed" }, "failed"],
    [{ code: "email_not_confirmed", status: 400, message: "Email not confirmed" }, "failed"],
    [{ status: 500, message: "Database error querying schema" }, "failed"],
    [{ message: "no session returned" }, "failed"],
    [{}, "failed"],
  ];
  for (const [error, want] of cases) {
    const got = loginErrorFromAuth(error);
    assert.equal(got, want, JSON.stringify(error));
    assert.ok(loginErrorMessage(got), `${got} has text`);
  }
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

test("each attempt counts per address and per app; the address only as a hash", () => {
  const hash = (v: string) => `h(${v})`;
  assert.deepEqual(signInLimits("studio", "2001:db8:aa:1::7", hash), [
    { key: "login:ip:h(2001:db8:aa:1::/64)", ...SIGN_IN_LIMITS.address },
    { key: "login:app:studio", ...SIGN_IN_LIMITS.app },
  ]);
  // Both apps share the address count, not the app count.
  const capture = signInLimits("capture", "2001:db8:aa:1::8", hash);
  assert.deepEqual(capture.map((l) => l.key), ["login:ip:h(2001:db8:aa:1::/64)", "login:app:capture"]);
  // No address (local development): that count is left out.
  assert.deepEqual(signInLimits("capture", null, hash).map((l) => l.key), ["login:app:capture"]);
  // No count per email: one sender could otherwise lock a named account.
  assert.deepEqual(Object.keys(SIGN_IN_LIMITS).sort(), ["address", "app"]);
  for (const l of signInLimits("studio", "203.0.113.4", (v) => v)) assert.ok(l.key.length <= 300, l.key);
});

test("what both apps pass on stays inside GoTrue's count for one address", () => {
  // GoTrue v2.170 lets 30 password sign-ins through per address before its
  // per-5-minute rate applies (internal/api/options.go, Token limiter
  // SetBurst(30)), then GOTRUE_RATE_LIMIT_TOKEN_REFRESH per 5 minutes
  // (checked against this in auth-server-config.test.ts).
  assert.ok(2 * SIGN_IN_LIMITS.app.max <= 30);
  // One sender alone cannot use up an app's count.
  assert.ok(SIGN_IN_LIMITS.address.max < SIGN_IN_LIMITS.app.max);
  assert.equal(SIGN_IN_LIMITS.address.windowSeconds, SIGN_IN_LIMITS.app.windowSeconds);
  assert.equal(SIGN_IN_LIMITS.app.windowSeconds, 5 * 60);
});

test("counts are checked in order and stop at the first refusal", async () => {
  const limits = signInLimits("studio", "203.0.113.4", (v) => v);
  const seen: string[] = [];
  const allow = (refuse: string | null) => async (key: string) => {
    seen.push(key);
    return key !== refuse;
  };
  assert.equal(await withinSignInLimits(limits, allow(null)), true);
  assert.deepEqual(seen, ["login:ip:203.0.113.4", "login:app:studio"]);
  seen.length = 0;
  assert.equal(await withinSignInLimits(limits, allow("login:ip:203.0.113.4")), false);
  assert.deepEqual(seen, ["login:ip:203.0.113.4"], "a refused address does not use up the app's count");
  seen.length = 0;
  assert.equal(await withinSignInLimits(limits, allow("login:app:studio")), false);
  assert.deepEqual(seen, ["login:ip:203.0.113.4", "login:app:studio"]);
  // The window and maximum reach the limiter as given.
  const args: [string, number, number][] = [];
  await withinSignInLimits(limits, async (k, w, m) => (args.push([k, w, m]), true));
  assert.deepEqual(args[1], ["login:app:studio", 300, SIGN_IN_LIMITS.app.max]);
});

type CheckCode = "check-missing" | "check-failed" | "check-unavailable";

/** A sign-in whose steps answer as given and record the order they ran in. */
function steps(answers: { check?: { ok: boolean; code?: CheckCode }; count?: boolean; signIn?: Parameters<typeof loginErrorFromAuth>[0] }) {
  const ran: string[] = [];
  return {
    ran,
    steps: {
      check: async () => (ran.push("check"), answers.check ?? { ok: true }),
      count: async () => (ran.push("count"), answers.count ?? true),
      signIn: async () => (ran.push("signIn"), answers.signIn ?? null),
    },
  };
}

test("the Cloudflare check runs before anything is counted or the auth server is asked", async () => {
  for (const code of ["check-missing", "check-failed", "check-unavailable"] as const) {
    const s = steps({ check: { ok: false, code } });
    assert.equal(await runPasswordSignIn(s.steps), code);
    assert.deepEqual(s.ran, ["check"], "a request without a solved check uses up no count");
  }
  const noCode = steps({ check: { ok: false } });
  assert.equal(await runPasswordSignIn(noCode.steps), "check-failed");
  assert.deepEqual(noCode.ran, ["check"]);
});

test("a used-up count stops the attempt before the auth server", async () => {
  const s = steps({ count: false });
  assert.equal(await runPasswordSignIn(s.steps), "rate-limited");
  assert.deepEqual(s.ran, ["check", "count"]);
});

test("the auth server's answer decides the rest", async () => {
  const ok = steps({});
  assert.equal(await runPasswordSignIn(ok.steps), null);
  assert.deepEqual(ok.ran, ["check", "count", "signIn"]);
  assert.equal(await runPasswordSignIn(steps({ signIn: { code: "invalid_credentials", status: 400 } }).steps), "credentials");
  assert.equal(await runPasswordSignIn(steps({ signIn: { code: "over_request_rate_limit", status: 429 } }).steps), "rate-limited");
  assert.equal(await runPasswordSignIn(steps({ signIn: { status: 500, message: "Database error" } }).steps), "failed");
});

test("the capture app's copies are identical", () => {
  for (const file of ["sign-in.ts", "password-sign-in.ts"]) {
    const here = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    const capture = readFileSync(new URL(`../../../../capture/src/app/login/${file}`, import.meta.url), "utf8");
    assert.equal(capture, here, `apps/capture/src/app/login/${file} must match apps/studio/src/app/login/${file}`);
  }
});

test("both apps verify the Cloudflare token the same way", () => {
  // The capture app's copy of lib/turnstile.ts differs only in its header comment.
  const body = (app: string) => {
    const text = readFileSync(new URL(`../../../../${app}/src/lib/turnstile.ts`, import.meta.url), "utf8");
    return text.slice(text.indexOf("export type TurnstileFailure"));
  };
  assert.ok(body("studio").includes("export async function verifyTurnstile("));
  assert.equal(body("capture"), body("studio"), "apps/capture/src/lib/turnstile.ts must match apps/studio/src/lib/turnstile.ts below its header");
});

test("both sign-in actions run the check, the counts and the sign-in through runPasswordSignIn", () => {
  // The order itself is tested above; this keeps the pages from calling the
  // auth server, or counting, outside it.
  for (const app of ["studio", "capture"]) {
    const page = readFileSync(new URL(`../../../../${app}/src/app/login/page.tsx`, import.meta.url), "utf8");
    assert.ok(/runPasswordSignIn\(\{\s*check: \(\) => verifyTurnstile\(token, ip\),\s*count: \(\) => signInAllowed\(ip\),\s*signIn: \(\) => passwordSignIn\(email, password\),\s*\}\)/.test(page), `${app} login page wires runPasswordSignIn`);
    const uses = (call: string) => page.split(call).length - 1;
    assert.equal(uses("verifyTurnstile("), 1, `${app}: the Cloudflare check runs only inside runPasswordSignIn`);
    assert.equal(uses("passwordSignIn("), 1, `${app}: the auth server is asked only inside runPasswordSignIn`);
    assert.equal(uses("signInWithPassword("), 0, `${app}: the page asks the auth server only through ./password-sign-in.ts`);
    assert.equal(uses("signInAllowed("), 2, `${app}: signInAllowed is defined once and called only inside runPasswordSignIn`);
  }
});

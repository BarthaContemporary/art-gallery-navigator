// node --test apps/capture/src/app/login/sign-in.test.ts
// The full cases live with the studio's copy (apps/studio/src/app/login/
// sign-in.test.ts), which also checks that this app's files are identical.
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { clientIp, LOGIN_ERRORS, loginErrorFromAuth, loginErrorMessage, runPasswordSignIn, signInLimits, withinSignInLimits } from "./sign-in.ts";

test("only known codes show text", () => {
  for (const [code, text] of Object.entries(LOGIN_ERRORS)) assert.equal(loginErrorMessage(code), text);
  assert.equal(loginErrorMessage("Invalid login credentials"), null);
  assert.equal(loginErrorMessage("__proto__"), null);
});

test("sign-in errors map to codes", () => {
  assert.equal(loginErrorFromAuth({ code: "invalid_credentials", status: 400 }), "credentials");
  assert.equal(loginErrorFromAuth({ status: 429 }), "rate-limited");
  assert.equal(loginErrorFromAuth({ status: 500, message: "captcha verification process failed" }), "failed");
  assert.equal(loginErrorFromAuth({ status: 500, message: "boom" }), "failed");
});

test("capture's sign-ins count per address and in capture's own app count", async () => {
  const ip = clientIp({ get: (n: string) => (n === "x-real-ip" ? "203.0.113.4" : null) });
  const limits = signInLimits("capture", ip, (v: string) => `h(${v})`);
  assert.deepEqual(limits.map((l: { key: string }) => l.key), ["login:ip:h(203.0.113.4)", "login:app:capture"]);
  assert.equal(await withinSignInLimits(limits, async (key: string) => !key.startsWith("login:app:")), false);
});

test("a failed Cloudflare check uses up no count and never reaches the auth server", async () => {
  const ran: string[] = [];
  const failure = await runPasswordSignIn({
    check: async () => (ran.push("check"), { ok: false, code: "check-missing" as const }),
    count: async () => (ran.push("count"), true),
    signIn: async () => (ran.push("signIn"), null),
  });
  assert.equal(failure, "check-missing");
  assert.deepEqual(ran, ["check"]);
});

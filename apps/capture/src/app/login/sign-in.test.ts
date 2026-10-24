// node --test apps/capture/src/app/login/sign-in.test.ts
// The full cases live with the studio's copy (apps/studio/src/app/login/
// sign-in.test.ts), which also checks that this app's file is identical.
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { authServerChecksCaptcha, clientIp, LOGIN_ERRORS, loginErrorFromAuth, loginErrorMessage, signInLimits, withinSignInLimits } from "./sign-in.ts";

test("only known codes show text", () => {
  for (const [code, text] of Object.entries(LOGIN_ERRORS)) assert.equal(loginErrorMessage(code), text);
  assert.equal(loginErrorMessage("Invalid login credentials"), null);
  assert.equal(loginErrorMessage("__proto__"), null);
});

test("sign-in errors map to codes", () => {
  assert.equal(loginErrorFromAuth({ code: "invalid_credentials", status: 400 }, false), "credentials");
  assert.equal(loginErrorFromAuth({ status: 429 }, true), "rate-limited");
  assert.equal(loginErrorFromAuth({ code: "captcha_failed", status: 400 }, true), "check-failed");
  assert.equal(loginErrorFromAuth({ status: 500, message: "captcha verification process failed" }, false), "check-missing");
  assert.equal(loginErrorFromAuth({ status: 500, message: "boom" }, false), "failed");
});

test("the auth-server captcha flag is off unless set", () => {
  assert.equal(authServerChecksCaptcha({}), false);
  assert.equal(authServerChecksCaptcha({ AUTH_SERVER_CAPTCHA: "0" }), false);
  assert.equal(authServerChecksCaptcha({ AUTH_SERVER_CAPTCHA: "1" }), true);
});

test("capture's sign-ins count per address, per email and in capture's own app count", async () => {
  const ip = clientIp({ get: (n: string) => (n === "x-real-ip" ? "203.0.113.4" : null) });
  const limits = signInLimits("capture", ip, "Staff@Example.com", (v) => `h(${v})`);
  assert.deepEqual(limits.map((l) => l.key), ["login:ip:h(203.0.113.4)", "login:email:h(staff@example.com)", "login:app:capture"]);
  assert.equal(await withinSignInLimits(limits, async (key) => !key.startsWith("login:email:")), false);
});

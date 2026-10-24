// node --test apps/studio/src/app/login/sign-in.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { authServerChecksCaptcha, LOGIN_ERRORS, loginErrorFromAuth, loginErrorMessage } from "./sign-in.ts";

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

test("the capture app's copy is identical", () => {
  const here = readFileSync(new URL("./sign-in.ts", import.meta.url), "utf8");
  const capture = readFileSync(new URL("../../../../capture/src/app/login/sign-in.ts", import.meta.url), "utf8");
  assert.equal(capture, here, "apps/capture/src/app/login/sign-in.ts must match apps/studio/src/app/login/sign-in.ts");
});

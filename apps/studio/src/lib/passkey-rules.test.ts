// node --test apps/studio/src/lib/passkey-rules.test.ts
// Checks the studio's passkey rules and the capture app's copy of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type * as Rules from "./passkey-rules";

// Loaded by URL: node needs the .ts extension, which the app's tsconfig does
// not allow in a static import (the type-only import above gives the types).
const studioUrl = new URL("./passkey-rules.ts", import.meta.url);
const captureUrl = new URL("../../../capture/src/lib/passkey-rules.ts", import.meta.url);
const copies: [string, typeof Rules][] = [
  ["studio", await import(studioUrl.href)],
  ["capture", await import(captureUrl.href)],
];

test("the capture copy matches the original below its header", () => {
  const body = (url: URL) => readFileSync(url, "utf8").replace(/^\/\*\*[\s\S]*?\*\/\n/, "");
  assert.equal(body(captureUrl), body(studioUrl));
});

for (const [app, r] of copies) {
  test(`${app}: challenge cookies are __Host- cookies over https`, () => {
    assert.equal(r.challengeCookieName("register", true), "__Host-pk_register");
    assert.equal(r.challengeCookieName("login", true), "__Host-pk_login");
    assert.equal(r.challengeCookieName("login", false), "pk_login");
  });

  test(`${app}: only a uuid is taken as a challenge id`, () => {
    assert.equal(r.isChallengeId("0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e"), true);
    for (const v of [undefined, null, "", "abc", "0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e;x", "0b8f7c1e2d3a4b5c8d9e0f1a2b3c4d5e", 42])
      assert.equal(r.isChallengeId(v), false, String(v));
  });

  test(`${app}: same-origin check`, () => {
    const own = "https://studio.joostvandenbergh.com";
    assert.equal(r.isSameOrigin(own, own), true);
    assert.equal(r.isSameOrigin("https://Studio.JoostvandenBergh.com", own), true);
    assert.equal(r.isSameOrigin("https://studio.joostvandenbergh.com:443", own), true);
    assert.equal(r.isSameOrigin("http://localhost:3000", "http://localhost:3000"), true);
    for (const o of [
      "https://web.joostvandenbergh.com", // a sibling subdomain: same site, other origin
      "https://joostvandenbergh.com",
      "http://studio.joostvandenbergh.com",
      "https://studio.joostvandenbergh.com:8443",
      "https://studio.joostvandenbergh.com.evil.example",
      "null",
      "",
      null,
      undefined,
      "not a url",
    ])
      assert.equal(r.isSameOrigin(o, own), false, String(o));
  });

  test(`${app}: the session's own sign-in time comes from amr`, () => {
    const claims = {
      sub: "u",
      amr: [
        { method: "password", timestamp: 1_700_000_000 },
        { method: "otp", timestamp: 1_700_000_500 },
      ],
    };
    // The account's last sign-in (another device) does not override the session's.
    assert.equal(r.sessionSignedInAt(claims, "2030-01-01T00:00:00Z"), 1_700_000_500);
    assert.equal(
      r.sessionSignedInAt({ amr: [{ method: "token_refresh", timestamp: 1_800_000_000 }, { method: "password", timestamp: 1_700_000_000 }] }),
      1_700_000_000,
    );
  });

  test(`${app}: without amr timestamps it falls back to the last sign-in, else nothing`, () => {
    assert.equal(r.sessionSignedInAt({ amr: ["password"] }, "2026-10-24T10:00:00Z"), Date.parse("2026-10-24T10:00:00Z") / 1000);
    assert.equal(r.sessionSignedInAt({}, "2026-10-24T10:00:00.900Z"), Math.floor(Date.parse("2026-10-24T10:00:00.900Z") / 1000));
    assert.equal(r.sessionSignedInAt({}, null), null);
    assert.equal(r.sessionSignedInAt(null), null);
    assert.equal(r.sessionSignedInAt({ amr: [{ method: "password", timestamp: "soon" }] }, "not a date"), null);
  });

  test(`${app}: a sign-in is fresh for ten minutes`, () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    const at = (minutesAgo: number) => now / 1000 - minutesAgo * 60;
    assert.equal(r.FRESH_SIGN_IN_SECONDS, 600);
    assert.equal(r.isFreshSignIn(at(0), now), true);
    assert.equal(r.isFreshSignIn(at(9), now), true);
    assert.equal(r.isFreshSignIn(at(10), now), true);
    assert.equal(r.isFreshSignIn(at(10) - 1, now), false);
    assert.equal(r.isFreshSignIn(at(60 * 24), now), false);
    // A little clock difference between the auth server and the app is fine.
    assert.equal(r.isFreshSignIn(at(-1), now), true);
    assert.equal(r.isFreshSignIn(null, now), false);
  });

  test(`${app}: the re-sign-in message names the limit`, () => {
    assert.match(r.REAUTH_MESSAGE, /within 10 minutes of signing in/);
  });
}

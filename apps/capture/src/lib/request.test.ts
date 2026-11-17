// node --test apps/capture/src/lib/request.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { jsonBody, messageOf, NO_CONNECTION, RequestError, requestJson, SIGNED_OUT } from "./request.ts";

type Fake = { status: number; redirected?: boolean; url?: string; body?: unknown; bad?: boolean };

function stubFetch(reply: Fake | "reject") {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (reply === "reject") throw new TypeError("Load failed");
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      redirected: reply.redirected ?? false,
      url: reply.url ?? "https://capture.example/api/x",
      json: async () => {
        if (reply.bad) throw new SyntaxError("Unexpected token <");
        return reply.body;
      },
    } as Response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

async function failure(reply: Fake | "reject"): Promise<RequestError> {
  const restore = stubFetch(reply);
  try {
    await requestJson("/api/x");
  } catch (e) {
    assert.ok(e instanceof RequestError);
    return e;
  } finally {
    restore();
  }
  throw new Error("expected a failure");
}

test("a 2xx JSON object comes back", async () => {
  const restore = stubFetch({ status: 200, body: { ok: true, photo: { id: "p1" } } });
  try {
    assert.deepEqual(await requestJson("/api/x"), { ok: true, photo: { id: "p1" } });
  } finally {
    restore();
  }
});

test("the server's error text is what the screen shows", async () => {
  const e = await failure({ status: 429, body: { error: "That is 240 in the last hour, the most allowed." } });
  assert.equal(e.status, 429);
  assert.equal(e.message, "That is 240 in the last hour, the most allowed.");
  assert.match((await failure({ status: 502, bad: true })).message, /502/);
});

test("signed out: a 401, or a redirect to the sign-in page, is never a success", async () => {
  const a = await failure({ status: 401, body: { error: "Unauthorized" } });
  assert.equal(a.signedOut, true);
  assert.equal(a.message, SIGNED_OUT);
  // The sign-in page's HTML after a followed redirect.
  const b = await failure({ status: 200, redirected: true, url: "https://capture.example/login", bad: true });
  assert.equal(b.signedOut, true);
});

test("no connection, and a 200 that is not a JSON object, are failures", async () => {
  assert.equal((await failure("reject")).message, NO_CONNECTION);
  assert.equal((await failure({ status: 200, bad: true })).status, 200);
  assert.equal((await failure({ status: 200, body: [1, 2] })).status, 200);
});

test("helpers", () => {
  assert.deepEqual(jsonBody("PATCH", { a: 1 }), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: '{"a":1}',
  });
  assert.equal(messageOf(new RequestError("Gone", 404), "x"), "Gone");
  assert.equal(messageOf(new Error("Could not start upload"), "x"), "Could not start upload");
  assert.equal(messageOf("weird", "Fallback"), "Fallback");
});

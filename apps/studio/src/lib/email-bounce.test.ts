// node --test apps/studio/src/lib/email-bounce.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bounceResetFor, bounceResetPatch } from "./email-bounce.ts";

const BOUNCED = "2026-11-01T10:00:00Z";

test("a new address clears the bounce", () => {
  assert.deepEqual(
    bounceResetPatch({ email: "old@example.com", email_bounced_at: BOUNCED }, "new@example.com"),
    { email_bounced_at: null },
  );
});

test("the same address, in another case or with spaces, keeps the bounce", () => {
  const stored = { email: " Client@Example.com ", email_bounced_at: BOUNCED };
  assert.deepEqual(bounceResetPatch(stored, "client@example.com"), {});
  assert.deepEqual(bounceResetPatch(stored, "CLIENT@EXAMPLE.COM"), {});
});

test("no bounce recorded: nothing to clear, whatever the address", () => {
  assert.deepEqual(bounceResetPatch({ email: "a@example.com", email_bounced_at: null }, "b@example.com"), {});
});

test("a row that was not read keeps the bounce", () => {
  assert.deepEqual(bounceResetPatch(null, "b@example.com"), {});
});

test("removing the address clears the bounce, and so does adding one where there was none", () => {
  assert.deepEqual(bounceResetPatch({ email: "a@example.com", email_bounced_at: BOUNCED }, null), {
    email_bounced_at: null,
  });
  assert.deepEqual(bounceResetPatch({ email: null, email_bounced_at: BOUNCED }, "a@example.com"), {
    email_bounced_at: null,
  });
});

/** The slice of a Supabase client bounceResetFor uses, answering `result`. */
function client(result: { data: unknown; error: unknown }) {
  const asked: unknown[] = [];
  const db = {
    from(table: string) {
      asked.push(table);
      return {
        select(cols: string) {
          asked.push(cols);
          return {
            eq(col: string, v: string) {
              asked.push([col, v]);
              return { maybeSingle: async () => result };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as Parameters<typeof bounceResetFor>[0], asked };
}

test("bounceResetFor reads the stored address of that contact", async () => {
  const { db, asked } = client({ data: { email: "old@example.com", email_bounced_at: BOUNCED }, error: null });
  assert.deepEqual(await bounceResetFor(db, "c1", "new@example.com"), { email_bounced_at: null });
  assert.deepEqual(asked, ["crm_contacts", "email, email_bounced_at", ["id", "c1"]]);
});

test("bounceResetFor keeps the bounce when the read fails or finds no row", async () => {
  assert.deepEqual(await bounceResetFor(client({ data: null, error: { message: "boom" } }).db, "c1", "new@example.com"), {});
  assert.deepEqual(await bounceResetFor(client({ data: null, error: null }).db, "c1", "new@example.com"), {});
});

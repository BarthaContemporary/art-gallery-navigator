// node "apps/studio/src/app/api/crm/contacts/[id]/route.test.ts"
// (node --test would read the brackets as a glob; pnpm test:unit finds it.)
//
// The contact autosave PATCH run for real against the in-memory PostgREST
// stand-in. `@/lib/supabase` (cookies, the auth server) and `next/server`
// are replaced by small fakes (lib/test-support/module-fakes.ts); everything
// else the route imports is the app's own code.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore TS5097
import "../../../../../lib/test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "../../../../../lib/test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { fakeModules, NEXT_SERVER } from "../../../../../lib/test-support/module-fakes.ts";

type Fake = { session: { user: { id: string; email: string }; roles: string[] } | null; db: unknown };
const state = globalThis as unknown as { __contactRoute: Fake };

fakeModules({
  "next/server": NEXT_SERVER,
  "@/lib/supabase": `
    export const getSession = async () => globalThis.__contactRoute.session;
    export const getSupabase = async () => globalThis.__contactRoute.db;
    export function hasRole(roles, ...wanted) { return wanted.some((w) => roles.includes(w)); }
  `,
});

// @ts-ignore TS5097
const { PATCH } = await import("./route.ts");

const STAFF = { user: { id: "u-staff", email: "staff@example.test" }, roles: ["staff"] };

function contact(extra: Row = {}): Row {
  return {
    id: "c1",
    first_name: "Aiko",
    last_name: "Sato",
    email: "aiko@example.test",
    email_bounced_at: null,
    custom_fields: { kept: "yes", interests: [] },
    marketing_consent: false,
    consent_date: null,
    consent_source: null,
    erased_at: null,
    ...extra,
  };
}

type Req = { table: string | null; op: string; columns: string | null };

/** `during` sees each request just before it runs, with the tables (to change them in between). */
async function patch(
  session: Fake["session"],
  rows: Row[],
  form: Record<string, string>,
  during?: (req: Req, tables: Record<string, Row[]>) => void,
) {
  let tables: Record<string, Row[]> = {};
  const fake = fakeSupabase({
    tables: { crm_contacts: rows },
    fail: (req: Req) => {
      during?.(req, tables);
      return null;
    },
  });
  tables = fake.tables;
  state.__contactRoute = { session, db: fake.client };
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) fd.set(k, v);
  const res: Response = await PATCH(new Request("http://studio.test/api/crm/contacts/c1", { method: "PATCH", body: fd }), {
    params: Promise.resolve({ id: "c1" }),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string };
  return { status: res.status, body, fake };
}

const writes = (fake: ReturnType<typeof fakeSupabase>) => fake.calls.filter((c: { op: string }) => c.op !== "select");

test("signed out: 401, and nothing is read or written", async () => {
  const { status, fake } = await patch(null, [contact()], { first_name: "A" });
  assert.equal(status, 401);
  assert.equal(fake.calls.length, 0);
});

test("a role other than admin or staff is refused before anything is read or written", async () => {
  const { status, body, fake } = await patch({ ...STAFF, roles: ["accountant"] }, [contact()], { first_name: "Mallory" });
  assert.equal(status, 403);
  assert.match(body.error ?? "", /role/);
  assert.equal(fake.calls.length, 0);
  assert.equal(fake.tables.crm_contacts![0]!.first_name, "Aiko");
});

test("an erased contact is refused for good (410) and never written", async () => {
  const { status, fake } = await patch(STAFF, [contact({ erased_at: "2026-11-01T00:00:00Z", first_name: null })], {
    first_name: "Aiko",
  });
  assert.equal(status, 410);
  assert.equal(writes(fake).length, 0);
  assert.equal(fake.tables.crm_contacts![0]!.first_name, null);
});

test("a contact erased between the read and the write is not written (404, final)", async () => {
  // The erasure lands after the route's own read (here, during its bounce read).
  const { status, fake } = await patch(STAFF, [contact()], { first_name: "Aiko", email: "aiko@example.test" }, (req, tables) => {
    if (req.table === "crm_contacts" && req.op === "select" && req.columns === "email, email_bounced_at") {
      Object.assign(tables.crm_contacts![0]!, { erased_at: "2026-11-17T09:00:00Z", first_name: null });
    }
  });
  assert.equal(status, 404);
  const row = fake.tables.crm_contacts![0]!;
  assert.equal(row.first_name, null, "nothing written back into the erased row");
  const update = writes(fake)[0]!;
  assert.ok(update.filters.some((f: { kind: string; column: string; value: unknown }) => f.kind === "is" && f.column === "erased_at" && f.value === null));
});

test("no such contact, or an update that matched no row, answers 404", async () => {
  assert.equal((await patch(STAFF, [], { first_name: "A" })).status, 404);
});

test("staff save the contact; fields not in the form are kept, and a corrected address clears its bounce", async () => {
  const { status, body, fake } = await patch(
    STAFF,
    [contact({ email_bounced_at: "2026-10-01T00:00:00Z" })],
    { first_name: " Aiko ", last_name: "Sato", email: "aiko.sato@example.test", marketing_consent_was: "", interests_was: "[]", interests: "[]" },
  );
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  const row = fake.tables.crm_contacts![0]!;
  assert.equal(row.first_name, "Aiko");
  assert.equal(row.email, "aiko.sato@example.test");
  assert.equal(row.email_bounced_at, null);
  assert.equal((row.custom_fields as Row).kept, "yes");
  assert.equal(row.marketing_consent, false, "an untouched consent box is not written");
});

test("the same address keeps the bounce stamp", async () => {
  const { status, fake } = await patch(STAFF, [contact({ email_bounced_at: "2026-10-01T00:00:00Z" })], {
    first_name: "Aiko",
    email: " AIKO@example.test ",
  });
  assert.equal(status, 200);
  assert.equal(fake.tables.crm_contacts![0]!.email_bounced_at, "2026-10-01T00:00:00Z");
});

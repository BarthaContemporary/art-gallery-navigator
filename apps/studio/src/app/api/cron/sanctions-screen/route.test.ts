// node --test apps/studio/src/app/api/cron/sanctions-screen/route.test.ts
//
// The fortnightly sanctions screen under an API row cap: every AML-confirmed
// contact is screened, not only the first page. The route runs as it is;
// the service client is the in-memory PostgREST stand-in with a cap of 1000
// rows per answer, and next/server, the email sender and the list download
// are stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore TS5097
import "../../../../lib/test-support/alias.ts";
// @ts-ignore TS5097
import { fakeSupabase, type Row } from "../../../../lib/test-support/fake-supabase.ts";
// @ts-ignore TS5097
import { fakeModules, NEXT_SERVER } from "../../../../lib/test-support/module-fakes.ts";

const state = globalThis as unknown as { __sanctions: { db: unknown } };
fakeModules({
  "next/server": NEXT_SERVER,
  "@jvb/db/server": `export const createServiceClient = () => globalThis.__sanctions.db;`,
  "@/lib/email": `export async function sendEmail() { throw new Error("no email in this test"); }`,
});
// @ts-ignore TS5097
const { GET } = await import("./route.ts");

/** A client whose every answer stops at `cap` rows, as PostgREST's db-max-rows does. */
function capped<C extends { from: (t: string) => unknown }>(client: C, cap: number): C {
  const wrap = (b: Record<string | symbol, unknown>): unknown =>
    new Proxy(b, {
      get(target, prop) {
        const v = target[prop];
        if (prop === "then") {
          return (ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) =>
            (v as (a: (r: { data: unknown }) => unknown) => Promise<unknown>)
              .call(target, (r: { data: unknown }) => ({ ...r, data: Array.isArray(r.data) ? r.data.slice(0, cap) : r.data }))
              .then(ok, bad);
        }
        if (typeof v !== "function") return v;
        return (...args: unknown[]) => {
          const out = (v as (...a: unknown[]) => unknown).apply(target, args);
          return out === target ? wrap(target) : out;
        };
      },
    });
  return { ...client, from: (t: string) => wrap(client.from(t) as Record<string | symbol, unknown>) };
}

const LIST = `<?xml version="1.0"?><Designations><DateGenerated>2026-11-01</DateGenerated>
<Designation><UniqueID>RUS0001</UniqueID><RegimeName>Russia</RegimeName><Names><Name><Name1>Ivan</Name1><Name6>PETROV</Name6><NameType>Primary Name</NameType></Name></Names></Designation>
</Designations>`;

test("every confirmed contact is screened past a row cap, in pages ordered by id", async () => {
  const contacts: Row[] = [];
  for (let i = 0; i < 2500; i++) {
    contacts.push({ id: `c${String(i).padStart(5, "0")}`, first_name: "Anna", last_name: `Collector${i}`, kyc_status: "verified" });
  }
  contacts.push({ id: "z-unconfirmed", first_name: "Bob", last_name: "Brown", kyc_status: "not_started" });
  const fake = fakeSupabase({ tables: { crm_contacts: contacts } });
  state.__sanctions = { db: capped(fake.client, 1000) };
  process.env.CRON_SECRET = "test-secret";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(LIST, { status: 200 })) as typeof fetch;
  try {
    const res: Response = await GET(
      new Request("http://studio.test/api/cron/sanctions-screen", { headers: { authorization: "Bearer test-secret" } }),
    );
    const body = (await res.json()) as { screened: number; matches: number };
    assert.equal(res.status, 200);
    assert.equal(body.screened, 2500, "not stopped at the first 1000");
    assert.equal(body.matches, 0);

    const reads = fake.calls.filter((c: { op: string; table: string | null }) => c.op === "select" && c.table === "crm_contacts");
    assert.ok(reads.length >= 3, "read in pages");
    for (const r of reads) {
      assert.ok(r.range, "each page is a range");
      assert.deepEqual(r.orders.map((o: { column: string }) => o.column), ["id"]);
    }
    const rows = fake.tables.crm_contacts!;
    assert.equal(rows.filter((r: Row) => r.sanctions_status === "clear").length, 2500);
    assert.equal(rows.find((r: Row) => r.id === "z-unconfirmed")!.sanctions_status, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a failed page screens nobody and says so", async () => {
  const fake = fakeSupabase({
    tables: { crm_contacts: [{ id: "c1", first_name: "Anna", last_name: "Smith", kyc_status: "verified" }] },
    fail: (req: { table: string | null; op: string }) =>
      req.table === "crm_contacts" && req.op === "select" ? { message: "connection reset" } : null,
  });
  state.__sanctions = { db: fake.client };
  process.env.CRON_SECRET = "test-secret";
  const res: Response = await GET(
    new Request("http://studio.test/api/cron/sanctions-screen", { headers: { authorization: "Bearer test-secret" } }),
  );
  assert.equal(res.status, 500);
  assert.match(((await res.json()) as { error: string }).error, /Could not read the contacts to screen: connection reset/);
  assert.equal(fake.calls.filter((c: { op: string }) => c.op === "update").length, 0);
});

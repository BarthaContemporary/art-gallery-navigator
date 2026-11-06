// node --test apps/web/src/lib/form-messages.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { zod3Wording } from "./form-messages.ts";

// Built like the public form routes' schemas (app/api/enquiry, booking, newsletter).
const form = z.object({
  kind: z.enum(["work", "publication"]),
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email().max(320),
  pieceId: z.guid().optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mailingList: z.boolean().optional(),
  consent: z.literal(true, { error: "Please tick the box to agree to be contacted" }),
});
const valid = { kind: "work", name: "Jane Smith", email: "jane@example.com", consent: true };

function firstMessage(schema: z.ZodType, body: unknown): string | undefined {
  const parsed = schema.safeParse(body, { error: zod3Wording });
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

test("problems the schemas leave unworded read as they did under Zod 3", () => {
  const cases: [unknown, string][] = [
    [{ ...valid, kind: undefined }, "Required"],
    [{ ...valid, kind: "sale" }, "Invalid enum value. Expected 'work' | 'publication', received 'sale'"],
    [{ ...valid, kind: 3 }, "Expected 'work' | 'publication', received number"],
    [{ ...valid, name: "n".repeat(201) }, "String must contain at most 200 character(s)"],
    [{ ...valid, name: null }, "Expected string, received null"],
    [{ ...valid, email: "jane@gallery" }, "Invalid email"],
    [{ ...valid, email: `${"a".repeat(309)}@example.com` }, "String must contain at most 320 character(s)"],
    [{ ...valid, pieceId: "not-a-uuid" }, "Invalid uuid"],
    [{ ...valid, phone: "  " }, "String must contain at least 1 character(s)"],
    [{ ...valid, date: "04/03/2027" }, "Invalid"],
    [{ ...valid, mailingList: "on" }, "Expected boolean, received string"],
    [{}, "Required"],
    [null, "Expected object, received null"],
    [[], "Expected object, received array"],
    ["hello", "Expected object, received string"],
  ];
  for (const [body, message] of cases) assert.equal(firstMessage(form, body), message, JSON.stringify(body));
  assert.equal(firstMessage(z.literal("x"), "y"), 'Invalid literal value, expected "x"');
  assert.equal(firstMessage(z.string().length(3), "ab"), "String must contain exactly 3 character(s)");
});

test("a message the schema sets itself still wins", () => {
  assert.equal(firstMessage(form, { ...valid, name: "   " }), "Please enter your name");
  for (const consent of [false, undefined, "true", null]) {
    assert.equal(firstMessage(form, { ...valid, consent }), "Please tick the box to agree to be contacted");
  }
  assert.equal(firstMessage(z.string().email("Please enter a valid email address"), "jane"), "Please enter a valid email address");
});

test("anything else keeps Zod 4's own wording", () => {
  const schema = z.number().min(1);
  const own = schema.safeParse(0);
  assert.ok(!own.success);
  assert.equal(firstMessage(schema, 0), own.error.issues[0]?.message);
});

test("the forms take and refuse the same email addresses as under Zod 3", () => {
  const email = z.string().trim().email();
  const taken = [
    "jane@example.com",
    "  jane@example.com  ",
    "Jane.Smith@Example.CO.UK",
    "o'brien@example.ie",
    "first.last+tag@sub.example.org",
    "jane_smith@example.museum",
    "jane-smith@example-gallery.com",
    "j@b.co",
    "1234@example.com",
    "user@xn--bcher-kva.example",
    "x@example.photography",
    "a.b.c.d@e.f.gh",
    "_@example.com",
    "jane@example-.com",
  ];
  const refused = [
    "user@mail.xn--p1ai",
    "user%tag@example.com",
    "user=tag@example.com",
    "user&co@example.com",
    "user/dept@example.com",
    "'quoted'@example.com",
    "jane@example",
    "jane@localhost",
    "jane@example.c",
    "jane@123.123.123.123",
    "jane@[123.123.123.123]",
    "jane.@example.com",
    ".jane@example.com",
    "jane..smith@example.com",
    "jane@-example.com",
    "jane@exa_mple.com",
    "jane@example..com",
    "jane smith@example.com",
    '"jane smith"@example.com',
    "jöhn@example.com",
    "jane@exämple.com",
    "jane@例え.jp",
    "o’brien@example.com",
    "jane@example.com.",
    "jane@@example.com",
    "@example.com",
    "",
  ];
  for (const v of taken) assert.ok(email.safeParse(v).success, `refused ${JSON.stringify(v)}`);
  for (const v of refused) assert.ok(!email.safeParse(v).success, `took ${JSON.stringify(v)}`);
});

test("piece ids take any 8-4-4-4-12 hex id, as Zod 3's uuid() did", () => {
  const id = z.guid();
  for (const v of [
    "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
    "3F2B8C1E-4D5A-4B6C-8D7E-9F0A1B2C3D4E",
    "00000000-0000-0000-0000-000000000001",
    "12345678-1234-1234-1234-123456789abc",
  ]) {
    assert.ok(id.safeParse(v).success, v);
  }
  for (const v of ["not-a-uuid", "", "3f2b8c1e4d5a4b6c8d7e9f0a1b2c3d4e", "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4"]) {
    assert.ok(!id.safeParse(v).success, v);
  }
});

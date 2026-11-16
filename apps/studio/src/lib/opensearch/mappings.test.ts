// node --test apps/studio/src/lib/opensearch/mappings.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { definition, indexBody, mappedFields, SETTINGS } from "./mappings.ts";
// @ts-ignore TS5097
import { INDEX_VERSION, SEARCH_KINDS } from "./config.ts";

type Props = Record<string, Record<string, unknown> & { fields?: Record<string, Record<string, unknown>> }>;

/**
 * A fingerprint of each kind's settings and mapping, tied to its INDEX_VERSION.
 * When this fails you changed what an index holds: bump INDEX_VERSION for that
 * kind in config.ts (the reconcile then builds the new version beside the old
 * one) and put the new version and fingerprint here.
 */
const FINGERPRINTS: Record<string, { version: number; sha256: string }> = {
  works: { version: 1, sha256: "8da136bc99310260" },
  makers: { version: 1, sha256: "7c4eec66b09d7812" },
  contacts: { version: 1, sha256: "acc323b819801adc" },
};

test("a mapping change must come with a version bump", () => {
  for (const kind of SEARCH_KINDS) {
    const sha256 = createHash("sha256").update(JSON.stringify(definition(kind))).digest("hex").slice(0, 16);
    assert.deepEqual({ version: INDEX_VERSION[kind], sha256 }, FINGERPRINTS[kind], `${kind}: bump INDEX_VERSION.${kind} and update FINGERPRINTS`);
  }
});

test("one index per kind, no records index", () => {
  assert.deepEqual([...SEARCH_KINDS], ["works", "makers", "contacts"]);
});

test("settings: one shard, no replica, explicit refresh, n-gram room", () => {
  assert.equal(SETTINGS.number_of_shards, 1);
  assert.equal(SETTINGS.number_of_replicas, 0);
  assert.equal(SETTINGS.refresh_interval, "1s");
  assert.equal(SETTINGS["index.max_ngram_diff"], 11);
});

test("every mapping is dynamic strict and stamped with its schema version", () => {
  for (const kind of SEARCH_KINDS) {
    const body = indexBody(kind, INDEX_VERSION[kind]);
    assert.equal(body.mappings.dynamic, "strict", kind);
    assert.deepEqual(body.mappings._meta, { schema_version: INDEX_VERSION[kind] }, kind);
    assert.equal(body.settings, SETTINGS);
    const props = body.mappings.properties as Props;
    assert.equal(props.id?.type, "keyword", `${kind} carries its uuid as a keyword`);
    assert.ok(props.all, `${kind} has the catch-all`);
  }
});

test("every text field scores flat (similarity boolean)", () => {
  for (const kind of SEARCH_KINDS) {
    const props = (indexBody(kind, 1).mappings.properties ?? {}) as Props;
    for (const [field, spec] of Object.entries(props)) {
      if (spec.type === "text") assert.equal(spec.similarity, "boolean", `${kind}.${field}`);
      for (const [sub, s] of Object.entries(spec.fields ?? {})) if (s.type === "text") assert.equal(s.similarity, "boolean", `${kind}.${field}.${sub}`);
    }
  }
});

test("contacts keep no copy: _source off, no doc values but the uuid, trimmed fields", () => {
  const m = indexBody("contacts", 1).mappings as { _source?: { enabled?: boolean }; properties: Props };
  assert.deepEqual(m._source, { enabled: false });
  for (const [field, spec] of Object.entries(m.properties)) {
    if (spec.type === "keyword" && field !== "id") assert.equal(spec.doc_values, false, field);
    for (const [sub, s] of Object.entries(spec.fields ?? {})) if (s.type === "keyword") assert.equal(s.doc_values, false, `${field}.${sub}`);
  }
  assert.deepEqual(mappedFields("contacts").sort(), ["all", "city", "country", "email", "first_name", "id", "last_name", "name", "organization", "phones"]);
  // Phone digits are only ever matched as phone digits.
  assert.equal(m.properties.phones?.copy_to, undefined);
});

test("no excluded field is mapped in any index", () => {
  const excluded = [
    // works
    "purchased_from", "sold_to", "consignment_details", "shares_note", "ai_suggestions", "source_note", "document_note",
    "purchase_price", "purchase_price_gbp", "purchase_cost_gbp", "marked_price_gbp", "sale_price_gbp", "net_profit_gbp", "deleted", "deleted_at",
    // contacts
    "notes", "address_line1", "address_line2", "postcode", "tags", "interested_regions", "contact_type", "custom_fields",
    "consent_evidence", "consent_confirm_token", "consent_source", "marketing_consent", "kyc_status", "sanctions_status",
    "last_screened_at", "salutation", "instagram_handle", "line_id", "wechat_id",
  ];
  const contactsOnly = new Set(["tags"]); // works carry their own (non-personal) tags
  for (const kind of SEARCH_KINDS) {
    const fields = mappedFields(kind);
    for (const f of excluded) {
      if (contactsOnly.has(f) && kind !== "contacts") continue;
      assert.ok(!fields.includes(f), `${kind}.${f} must not be indexed`);
    }
  }
  assert.ok(!mappedFields("makers").includes("notes"));
});

test("works: stock numbers exact, as n-grams and separator-free; highlights have real fields", () => {
  const props = indexBody("works", 1).mappings.properties as Props;
  for (const f of ["stock_number", "legacy_stock_number", "retired_stock_numbers"]) {
    assert.equal(props[f]?.type, "keyword", f);
    assert.ok(props[f]?.fields?.grams && props[f]?.fields?.compact, f);
  }
  assert.ok(props.provenance && props.maker_native?.fields?.cjk);
});

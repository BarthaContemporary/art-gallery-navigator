// node --test apps/studio/src/lib/opensearch/documents.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { CONTACT_COLUMNS, MAKER_COLUMNS, MAX_FIELD_CHARS, WORK_COLUMNS, contactDoc, makerDoc, stripHtml, workDoc } from "./documents.ts";
// @ts-ignore TS5097
import { mappedFields } from "./mappings.ts";

const W = "b1ec0000-0002-4000-8000-b1ec00000000";
const M = "aa000000-0001-4000-8000-aa0000000000";

/** A work row as a careless `select *` would return it: every excluded column filled with a marker. */
function fullWorkRow(over: Record<string, unknown> = {}) {
  return {
    id: W,
    stock_number: "2024-0003",
    legacy_stock_number: "J5333",
    title: "Tea bowl",
    maker_id: M,
    category_id: "c1",
    medium: "Stoneware",
    period: "Shōwa",
    year: "1955",
    origin_region: "Mashiko",
    description: "A bowl",
    condition_report: "Fine",
    signature_inscription: "Signed on the base",
    box_type: "Tomobako",
    box_notes: "inscribed lid",
    dimensions_display: "8 x 12 cm",
    comments: "Good",
    tags: ["mingei", ""],
    publications: ["Catalogue 2019, no. 12"],
    exhibitions: "TEFAF Maastricht, 2023",
    published_note: "see catalogue",
    status: "in_stock",
    ledger: "jvb",
    web_visible: true,
    framed: false,
    location_id: "l1",
    deleted_at: null,
    // Never to be indexed:
    purchased_from: "SECRET-purchased-from",
    sold_to: "SECRET-sold-to",
    consignment_details: "SECRET-consignment",
    shares_note: "SECRET-shares",
    ai_suggestions: { title: "SECRET-ai" },
    source_note: "SECRET-source",
    document_note: "SECRET-document",
    purchase_price_gbp: 123456,
    marked_price_gbp: 654321,
    consignee_contact_id: "SECRET-consignee",
    photographer: "SECRET-photographer",
    ...over,
  };
}

function workSource(over: Record<string, unknown> = {}) {
  return {
    work: fullWorkRow(over) as never,
    maker: { id: M, display_name: "Hamada Shōji", native_name: "濱田庄司", romanized_name: "Hamada Shōji", alt_names: ["Shoji Hamada"], school_or_workshop: "Mashiko", notes: "SECRET-maker-notes" } as never,
    category: { id: "c1", name: "Ceramics" },
    location: { id: "l1", code: "SJ-B2", name: "Back room" },
    provenance: [
      { id: "SECRET-prov-row-1", piece_id: W, sort_order: 2, date_text: "2001", party: "Mr Smith", details: null },
      { id: "SECRET-prov-row-2", piece_id: W, sort_order: 1, date_text: "1985", party: "Acquired from the artist", details: null },
      { id: "SECRET-prov-row-3", piece_id: "someone-else", sort_order: 0, date_text: "x", party: "SECRET-other-work", details: null },
    ],
    moves: [{ id: "SECRET-move-row-1", piece_id: W, from_stock_number: "2023-0099" }, { id: "SECRET-move-row-2", piece_id: W, from_stock_number: "2024-0003" }],
  };
}

test("a work row carrying every excluded field yields a document without it", () => {
  const doc = workDoc(workSource());
  assert.ok(doc);
  const text = JSON.stringify(doc);
  assert.ok(!text.includes("SECRET"), text);
  for (const k of ["purchased_from", "sold_to", "consignment_details", "shares_note", "ai_suggestions", "source_note", "document_note", "purchase_price_gbp", "marked_price_gbp", "deleted_at", "box_type", "photographer"]) {
    assert.ok(!(k in doc), k);
  }
  // Exactly the mapped fields, nothing else (the mapping is strict anyway).
  for (const k of Object.keys(doc)) assert.ok(mappedFields("works").includes(k), k);
});

test("the selected columns never name an excluded one", () => {
  for (const c of ["purchased_from", "sold_to", "consignment_details", "shares_note", "ai_suggestions", "source_note", "document_note", "notes"]) {
    assert.ok(!(WORK_COLUMNS as readonly string[]).includes(c), c);
    assert.ok(!(MAKER_COLUMNS as readonly string[]).includes(c), c);
  }
  for (const c of ["notes", "address_line1", "address_line2", "postcode", "tags", "interested_regions", "contact_type", "custom_fields", "consent_evidence", "consent_confirm_token", "kyc_status", "sanctions_status", "salutation"]) {
    assert.ok(!(CONTACT_COLUMNS as readonly string[]).includes(c), c);
  }
});

test("work fields: maker, category, location, provenance in order, former numbers, jsonb lists", () => {
  const doc = workDoc(workSource())!;
  assert.equal(doc.id, W);
  assert.equal(doc.stock_number, "2024-0003");
  assert.equal(doc.maker_name, "Hamada Shōji");
  assert.equal(doc.maker_romanized, undefined, "same as the display name");
  assert.deepEqual(doc.maker_alt_names, ["Shoji Hamada"]);
  assert.equal(doc.maker_native, "濱田庄司");
  assert.equal(doc.category, "Ceramics");
  assert.equal(doc.location, "SJ-B2 Back room");
  assert.deepEqual(doc.provenance, ["1985 Acquired from the artist", "2001 Mr Smith"]);
  assert.deepEqual(doc.retired_stock_numbers, ["2023-0099"]);
  assert.deepEqual(doc.publications, ["Catalogue 2019, no. 12"]);
  assert.deepEqual(doc.exhibitions, ["TEFAF Maastricht, 2023"], "a legacy string is a one-item list");
  assert.deepEqual(doc.tags, ["mingei"]);
  assert.equal(doc.box_notes, "Tomobako inscribed lid");
  assert.equal(doc.web_visible, true);
  assert.equal(doc.framed, false);
});

test("a work in the trash, or one that is gone, builds no document", () => {
  assert.equal(workDoc(workSource({ deleted_at: "2026-11-01T00:00:00Z" })), null);
  assert.equal(workDoc(null), null);
  assert.equal(workDoc(undefined), null);
});

test("related rows that belong elsewhere are ignored", () => {
  const src = workSource({ maker_id: "another", category_id: null, location_id: null });
  const doc = workDoc(src)!;
  assert.equal(doc.maker_name, undefined);
  assert.equal(doc.category, undefined);
  assert.equal(doc.location, undefined);
});

test("highlight markers are stripped and long values cut", () => {
  const doc = workDoc(workSource({ title: "Fake hit", description: "y".repeat(MAX_FIELD_CHARS + 500) }))!;
  assert.equal(doc.title, "Fake hit");
  assert.equal(doc.description!.length, MAX_FIELD_CHARS);
});

test("empty values are left out, not sent as empty strings", () => {
  const doc = workDoc(workSource({ title: "  ", medium: "", tags: [], publications: [], exhibitions: null, legacy_stock_number: null }))!;
  for (const k of ["title", "medium", "tags", "publications", "exhibitions", "legacy_stock_number"]) assert.ok(!(k in doc), k);
});

test("maker: names, HTML stripped from the biography, internal notes never indexed", () => {
  const doc = makerDoc({
    id: M,
    display_name: "Yokota Yōsai",
    native_name: null,
    romanized_name: "Yokota Yosai",
    alt_names: ["Yōsai"],
    school_or_workshop: null,
    life_dates: "1935-",
    region: "Ōita",
    biography: "Bamboo artist.",
    profile_html: "<p>Works in <b>mingei</b>&nbsp;style.</p><script>alert('SECRET')</script>",
    web_visible: true,
    notes: "SECRET-spelling to check",
  } as never)!;
  assert.equal(doc.name, "Yokota Yōsai");
  assert.equal(doc.name_sort, "Yokota Yōsai");
  assert.equal(doc.romanized_name, "Yokota Yosai");
  assert.equal(doc.biography, "Bamboo artist. Works in mingei style.");
  assert.ok(!JSON.stringify(doc).includes("SECRET"));
  for (const k of Object.keys(doc)) assert.ok(mappedFields("makers").includes(k), k);
  assert.equal(makerDoc(null), null);
});

test("stripHtml: tags, comments, scripts and entities", () => {
  assert.equal(stripHtml("<p>a &amp; b</p><!-- x --><style>p{}</style>c"), "a & b c");
  assert.equal(stripHtml(""), undefined);
  assert.equal(stripHtml("<br/>"), undefined);
});

/** A contact row as `select *` would return it. */
function fullContact(over: Record<string, unknown> = {}) {
  return {
    id: "c0000000-0001-4000-8000-c00000000000",
    first_name: "Hiroshi",
    last_name: "Tanaka",
    organization_id: "o1",
    email: "h.tanaka@example.jp",
    phone: "+44 20 7946 0018",
    whatsapp_number: "07700 900104",
    city: "Kyōto",
    country: "Japan",
    erased_at: null,
    notes: "SECRET-notes",
    address_line1: "SECRET-street",
    address_line2: "SECRET-street2",
    postcode: "SECRET-postcode",
    tags: ["SECRET-tag"],
    interested_regions: ["SECRET-region"],
    contact_type: "SECRET-type",
    custom_fields: { x: "SECRET-custom" },
    consent_evidence: { ip: "SECRET-ip" },
    consent_confirm_token: "SECRET-token",
    kyc_status: "SECRET-kyc",
    sanctions_status: "SECRET-sanctions",
    salutation: "SECRET-salutation",
    instagram_handle: "SECRET-insta",
    ...over,
  };
}

test("a contact row carrying every excluded field yields a document without it", () => {
  const doc = contactDoc({ contact: fullContact() as never, organization: { id: "o1", name: "Kyoto Museum" } })!;
  assert.ok(!JSON.stringify(doc).includes("SECRET"), JSON.stringify(doc));
  assert.deepEqual(doc, {
    id: "c0000000-0001-4000-8000-c00000000000",
    first_name: "Hiroshi",
    last_name: "Tanaka",
    name: "Hiroshi Tanaka",
    organization: "Kyoto Museum",
    email: "h.tanaka@example.jp",
    phones: ["442079460018", "07700900104"],
    city: "Kyōto",
    country: "Japan",
  });
  for (const k of Object.keys(doc)) assert.ok(mappedFields("contacts").includes(k), k);
});

test("an erased contact (pseudonymised or deleted) builds no document", () => {
  assert.equal(contactDoc({ contact: fullContact({ erased_at: "2026-11-01T00:00:00Z", first_name: "Erased contact" }) as never, organization: null }), null);
  assert.equal(contactDoc(null), null);
  assert.equal(contactDoc(undefined), null);
});

test("contact: another organisation's row is ignored; short phone digits are dropped", () => {
  const doc = contactDoc({ contact: fullContact({ phone: "12", whatsapp_number: null }) as never, organization: { id: "o2", name: "Other" } })!;
  assert.equal(doc.organization, undefined);
  assert.equal(doc.phones, undefined);
});

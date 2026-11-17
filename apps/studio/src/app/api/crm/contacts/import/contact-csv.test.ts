// node --test apps/studio/src/app/api/crm/contacts/import/contact-csv.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCell, hasIdentityColumn, mapHeaders, normaliseHeader } from "./contact-csv.ts";

test("the studio's own contacts.csv header comes back in whole", () => {
  // As api/export/contacts.csv writes it, byte-order mark included.
  const header = [
    "﻿first_name", "last_name", "email", "phone", "address_line1", "address_line2",
    "city", "postcode", "country", "contact_type",
  ];
  const { columns, ignored } = mapHeaders(header);
  assert.deepEqual(columns, [
    "first_name", "last_name", "email", "phone", "address_line1", "address_line2",
    "city", "postcode", "country", "contact_type",
  ]);
  assert.deepEqual(ignored, []);
});

test("the studio's contacts.xlsx headers, saved as CSV, come back in whole", () => {
  // prettyHeader's output for the same columns.
  const header = ["First name", "Last name", "Email", "Phone", "Address line1", "Address line2", "City", "Postcode", "Country", "Contact type"];
  const { columns, ignored } = mapHeaders(header);
  assert.equal(columns.includes(null), false);
  assert.deepEqual(ignored, []);
  assert.equal(columns[4], "address_line1");
  assert.equal(columns[5], "address_line2");
});

test("common variants still match, case and spacing aside", () => {
  assert.equal(normaliseHeader("  First   Name "), "first name");
  assert.equal(normaliseHeader("E-mail"), "e-mail");
  const { columns } = mapHeaders(["FirstName", "Surname", "E-mail", "Tel", "ZIP", "Address 1"]);
  assert.deepEqual(columns, ["first_name", "last_name", "email", "phone", "postcode", "address_line1"]);
});

test("a Title column is not taken as the salutation, and is reported", () => {
  const { columns, ignored } = mapHeaders(["Title", "First Name", "Last Name", "Salutation", "Company", ""]);
  assert.deepEqual(columns, [null, "first_name", "last_name", "salutation", null, null]);
  assert.deepEqual(ignored, ["Title", "Company"]);
});

test("a file needs a name or an email column", () => {
  assert.equal(hasIdentityColumn(mapHeaders(["city", "postcode", "phone"]).columns), false);
  assert.equal(hasIdentityColumn(mapHeaders(["email", "city"]).columns), true);
  assert.equal(hasIdentityColumn(mapHeaders(["last_name"]).columns), true);
});

test("the export's formula guard is taken off, nothing else", () => {
  assert.equal(cleanCell("'+44 20 7946 0000"), "+44 20 7946 0000");
  assert.equal(cleanCell("'=1+1"), "=1+1");
  assert.equal(cleanCell("'-2"), "-2");
  assert.equal(cleanCell("'@handle"), "@handle");
  assert.equal(cleanCell("'t Hoff"), "'t Hoff");
  assert.equal(cleanCell("O'Brien"), "O'Brien");
  assert.equal(cleanCell("  Kyoto  "), "Kyoto");
});

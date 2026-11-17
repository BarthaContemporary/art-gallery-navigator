// node --test apps/studio/src/lib/address-pick.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { addressFromPlace, mapQuery } from "./address-pick.ts";

const notBusiness = { establishment: false };

test("a London pick fills every line from the place", () => {
  const a = addressFromPlace(
    { street_number: "10", route: "Old Street", subpremise: "Flat 3", postal_town: "London", postal_code: "EC1V 9BD", country: "United Kingdom" },
    { ...notBusiness, formattedAddress: "Flat 3, 10 Old Street, London EC1V 9BD, UK" },
    "",
  );
  assert.deepEqual(a, {
    line1: "10 Old Street",
    line2: "Flat 3",
    city: "London",
    postcode: "EC1V 9BD",
    country: "United Kingdom",
    company: "",
  });
});

test("parts the new place lacks are emptied, never kept from the old address", () => {
  // Hong Kong has no postcodes; this house has no flat.
  const a = addressFromPlace(
    { street_number: "1", route: "Queen's Road Central", locality: "Central", country: "Hong Kong" },
    { ...notBusiness, formattedAddress: "1 Queen's Road Central, Central, Hong Kong" },
    "Christie's",
  );
  assert.equal(a.postcode, "");
  assert.equal(a.line2, "");
  assert.equal(a.line1, "1 Queen's Road Central");
  assert.equal(a.city, "Central");
  assert.equal(a.company, "Christie's", "the company is kept unless a business was picked");
});

test("a Japanese address (no route) takes its line 1 from the formatted address", () => {
  const a = addressFromPlace(
    {
      sublocality_level_1: "Roppongi",
      sublocality_level_2: "6-chōme",
      sublocality_level_3: "10",
      premise: "1",
      locality: "Minato City",
      administrative_area_level_1: "Tokyo",
      postal_code: "106-6108",
      country: "Japan",
    },
    { ...notBusiness, formattedAddress: "6-chōme-10-1 Roppongi, Minato City, Tokyo 106-6108, Japan" },
    "",
  );
  assert.equal(a.line1, "6-chōme-10-1 Roppongi");
  assert.equal(a.line2, "", "the premise number is part of line 1 here, not line 2");
  assert.equal(a.city, "Minato City");
  assert.equal(a.postcode, "106-6108");
  assert.equal(a.country, "Japan");
});

test("a town or a bare postcode picked leaves line 1 empty", () => {
  const town = addressFromPlace({ locality: "Kyoto", country: "Japan" }, { ...notBusiness, formattedAddress: "Kyoto, Japan" }, "");
  assert.equal(town.line1, "");
  assert.equal(town.city, "Kyoto");
  const pc = addressFromPlace(
    { postal_code: "EC1V 9BD", postal_town: "London", country: "United Kingdom" },
    { ...notBusiness, formattedAddress: "London EC1V 9BD, UK" },
    "",
  );
  assert.equal(pc.line1, "");
});

test("without a formatted address, line 1 is built from the block parts", () => {
  const a = addressFromPlace(
    { sublocality_level_2: "6", sublocality_level_3: "10", premise: "1", locality: "Minato City", country: "Japan" },
    notBusiness,
    "",
  );
  assert.equal(a.line1, "6-10-1");
});

test("a business pick names the company", () => {
  const a = addressFromPlace(
    { street_number: "8", route: "King Street", postal_town: "London", postal_code: "SW1Y 6QT", country: "United Kingdom" },
    { establishment: true, name: "Christie's", formattedAddress: "8 King St, London SW1Y 6QT, UK" },
    "Old company",
  );
  assert.equal(a.company, "Christie's");
});

test("the map query joins the lines shown", () => {
  assert.equal(mapQuery({ line1: "10 Old Street", line2: "", city: "London", postcode: "EC1V 9BD", country: "UK" }), "10 Old Street, London, EC1V 9BD, UK");
  assert.equal(mapQuery({ line1: "", line2: "", city: "", postcode: "", country: "" }), "");
});

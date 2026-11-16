// node --test apps/studio/src/lib/sanctions-match.test.ts
// The UK Sanctions List name test. It used to compare a whole first or last
// name with single words, so any name of two words or more came out "clear".
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeXmlText,
  designationNames,
  nameMatches,
  normName,
  screeningTarget,
  type ScreeningTarget,
  // node --test needs the extension; the studio's tsconfig does not allow it.
  // @ts-ignore TS5097
} from "./sanctions-match.ts";

/** A list in the FCDO file's shape: one designation per entry, each name split into Name1…Name6. */
function list(entries: { uid: string; regime?: string; names: string[][] }[]): string {
  const name = (parts: string[]) =>
    `<Name>${parts.map((p, i) => `<Name${i === parts.length - 1 ? 6 : i + 1}>${p}</Name${i === parts.length - 1 ? 6 : i + 1}>`).join("")}<NameType>Primary Name</NameType></Name>`;
  return `<?xml version="1.0"?><Designations><DateGenerated>2026-11-01</DateGenerated>${entries
    .map(
      (e) =>
        `<Designation><UniqueID>${e.uid}</UniqueID><RegimeName>${e.regime ?? "Russia"}</RegimeName><Names>${e.names.map(name).join("")}</Names></Designation>`,
    )
    .join("")}</Designations>`;
}

/** Contact id → the uids it matched. */
function screen(contacts: [string, string | null, string | null][], xml: string): Map<string, string[]> {
  const targets = contacts
    .map(([id, first_name, last_name]) => screeningTarget({ id, first_name, last_name }))
    .filter((t): t is ScreeningTarget => t !== null);
  const hits = new Map<string, string[]>(targets.map((t) => [t.id, []]));
  for (const d of designationNames(xml)) for (const t of targets) if (nameMatches(t, d.words)) hits.get(t.id)!.push(d.uid);
  return hits;
}

const XML = list([
  { uid: "RUS0001", names: [["Igor", "Ivanovich", "SECHIN"]] },
  { uid: "DPR0001", regime: "Democratic People's Republic of Korea", names: [["Jong", "Un", "KIM"]] },
  { uid: "SYR0001", regime: "Syria", names: [["Bashar", "AL-ASSAD"]] },
  { uid: "IRL0001", names: [["Sean", "O&apos;BRIEN"]] },
  { uid: "AFG0001", regime: "Afghanistan", names: [["Mohammad", "Hassan", "AKHUND"]] },
  { uid: "FRA0001", names: [["Jean-Pierre", "DUPONT"]] },
  { uid: "NLD0001", names: [["Joost", "VAN DEN BERGH"]] },
  { uid: "CZE0001", names: [["Old&#345;ich", "NOV&#xC1;K"]] },
]);

test("compound, hyphenated and particle surnames and double given names all match", () => {
  const hits = screen(
    [
      ["igor", "Igor", "Sechin"],
      ["igor-iv", "Igor Ivanovich", "Sechin"],
      ["kim", "Jong Un", "Kim"],
      ["assad", "Bashar", "Al-Assad"],
      ["obrien", "Sean", "O'Brien"],
      ["akhund", "Mohammad Hassan", "Akhund"],
      ["dupont", "Jean-Pierre", "Dupont"],
      ["vdb", "Joost", "van den Bergh"],
      ["novak", "Oldřich", "Novák"],
    ],
    XML,
  );
  assert.deepEqual(Object.fromEntries(hits), {
    igor: ["RUS0001"],
    "igor-iv": ["RUS0001"],
    kim: ["DPR0001"],
    assad: ["SYR0001"],
    obrien: ["IRL0001"],
    akhund: ["AFG0001"],
    dupont: ["FRA0001"],
    vdb: ["NLD0001"],
    novak: ["CZE0001"],
  });
});

test("a contact with more given names than the listing still meets it", () => {
  const xml = list([{ uid: "RUS0002", names: [["Igor", "SECHIN"]] }]);
  assert.deepEqual(screen([["c", "Igor Ivanovich", "Sechin"]], xml).get("c"), ["RUS0002"]);
});

test("every surname word must be there, and the given name; other people stay clear", () => {
  const hits = screen(
    [
      ["half-surname", "Joost", "Bergh"], // the listing's surname is "van den Bergh": "bergh" alone is in it
      ["more-surname", "Joost", "van den Berg"], // "berg" is not "bergh"
      ["other-given", "Pieter", "van den Bergh"],
      ["other-family", "Bashar", "Assadi"],
      ["swapped", "Kim", "Jong Un"], // the order of the parts is not trusted
    ],
    XML,
  );
  assert.deepEqual(Object.fromEntries(hits), {
    "half-surname": ["NLD0001"],
    "more-surname": [],
    "other-given": [],
    "other-family": [],
    swapped: ["DPR0001"],
  });
});

test("an initial is not the given name screened on", () => {
  const xml = list([{ uid: "USA0001", names: [["Robert", "OPPENHEIMER"]] }]);
  assert.deepEqual(screen([["c", "J. Robert", "Oppenheimer"]], xml).get("c"), ["USA0001"]);
});

test("names too short to screen without noise are left out, as before", () => {
  assert.equal(screeningTarget({ id: "a", first_name: "J", last_name: "Smith" }), null);
  assert.equal(screeningTarget({ id: "b", first_name: "Jo", last_name: "Li" }), null);
  assert.equal(screeningTarget({ id: "c", first_name: null, last_name: "Sechin" }), null);
  assert.equal(screeningTarget({ id: "d", first_name: "Igor", last_name: null }), null);
  assert.deepEqual(screeningTarget({ id: "e", first_name: "Jean-Pierre", last_name: "Al-Assad" }), {
    id: "e",
    name: "Jean-Pierre Al-Assad",
    given: "jean",
    surname: ["al", "assad"],
  });
});

test("the list's entities are decoded once, and its names and fields read", () => {
  assert.equal(decodeXmlText("O&apos;BRIEN &amp; &quot;Co&quot; &lt;x&gt; &#233;&#xE9;"), "O'BRIEN & \"Co\" <x> éé");
  assert.equal(decodeXmlText("&amp;apos;"), "&apos;");
  assert.equal(normName("  Ó'Brien-Smith  "), "o brien smith");
  const names = designationNames(
    list([{ uid: "X1", regime: "Global Human Rights", names: [["Sean", "O&apos;BRIEN"], ["Shaun", "OBRIEN"]] }]),
  );
  assert.deepEqual(
    names.map((n) => [n.name, [...n.words], n.regime, n.uid]),
    [
      ["Sean O'BRIEN", ["sean", "o", "brien"], "Global Human Rights", "X1"],
      ["Shaun OBRIEN", ["shaun", "obrien"], "Global Human Rights", "X1"],
    ],
  );
  assert.deepEqual(designationNames("<Designations></Designations>"), []);
});

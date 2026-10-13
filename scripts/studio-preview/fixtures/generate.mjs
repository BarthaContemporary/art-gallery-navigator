#!/usr/bin/env node
/*
 * Writes fixtures/data/*.json: the preview's fictional database.
 *
 * A London dealer in twentieth-century Japanese and Indian art. The makers
 * are real artists from the gallery's own published catalogues (see
 * docs/catalogue-artist-links-2026-10-08.md), with no invented biography.
 * Every person (contacts, buyers, sellers, consignors, appointments,
 * enquiries, offer recipients, users, data-protection subjects) is invented:
 * example.com emails, Ofcom drama-range phone numbers, streets that do not
 * exist and ZZ postcodes, which no real address uses.
 *
 * Deterministic: a seeded generator, ids derived from counters, dates
 * relative to ANCHOR (the mock shifts them to today when it loads). Edit this
 * file and run it again rather than editing the JSON by hand, unless the
 * change is a one-off experiment.
 *
 * Usage: node scripts/studio-preview/fixtures/generate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { USERS, OTHER_USERS } from "../lib/session.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "data");
const ANCHOR = "2026-10-13";
const ANCHOR_MS = Date.parse(`${ANCHOR}T12:00:00Z`);
const DAY = 86_400_000;

// ------------------------------------------------------------------ helpers

let seed = 20261013;
function rnd() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const round = (n, step = 50) => Math.round(n / step) * step;

const counters = {};
/** Stable uuid per table: tag (4 hex) + counter. */
function uid(tag) {
  counters[tag] = (counters[tag] ?? 0) + 1;
  const n = counters[tag].toString(16).padStart(8, "0");
  return `${tag}${n.slice(0, 4)}-${n.slice(4, 8)}-4000-8000-${tag}${"0".repeat(8)}`;
}

const daysAgo = (d, hour = 10) => new Date(ANCHOR_MS - d * DAY + (hour - 12) * 3_600_000).toISOString();
const dateAgo = (d) => new Date(ANCHOR_MS - d * DAY).toISOString().slice(0, 10);
const daysAhead = (d, hour = 10, min = 0) => new Date(ANCHOR_MS + d * DAY + (hour - 12) * 3_600_000 + min * 60_000).toISOString();

const ADMIN = USERS.admin.id;
const STAFF = USERS.staff.id;
const ACCOUNTANT = OTHER_USERS[0].id;

const db = {};
const T = (name) => (db[name] ??= []);

// ------------------------------------------------------------ people, users

T("profiles").push(
  { id: ADMIN, full_name: USERS.admin.full_name, created_at: daysAgo(590) },
  { id: STAFF, full_name: USERS.staff.full_name, created_at: daysAgo(400) },
  { id: ACCOUNTANT, full_name: OTHER_USERS[0].full_name, created_at: daysAgo(380) },
);
T("user_roles").push(
  { id: uid("0e01"), user_id: ADMIN, role: "admin", created_at: daysAgo(590) },
  { id: uid("0e01"), user_id: STAFF, role: "staff", created_at: daysAgo(400) },
  { id: uid("0e01"), user_id: ACCOUNTANT, role: "accountant", created_at: daysAgo(380) },
);
T("webauthn_credentials").push({
  id: uid("0e02"),
  user_id: ADMIN,
  credential_id: "cHJldmlldy1jcmVkZW50aWFs",
  public_key: "preview",
  counter: 12,
  transports: ["internal", "hybrid"],
  device_label: "MacBook Air (Touch ID)",
  created_at: daysAgo(120),
  last_used_at: daysAgo(2),
});

// --------------------------------------------------------- reference tables

const CATEGORIES = [
  ["BAM", "Bamboo basket"],
  ["CER", "Ceramics"],
  ["LAC", "Lacquer"],
  ["MET", "Metalwork"],
  ["PNT", "Painting"],
  ["TAN", "Tantric painting"],
  ["WOP", "Work on paper"],
  ["MAN", "Manuscript"],
  ["TEX", "Textile"],
  ["SCU", "Sculpture"],
  ["WOO", "Woodwork"],
  ["PHO", "Photograph"],
  ["FUR", "Furniture"], // inactive, kept for old records
];
const cat = {};
CATEGORIES.forEach(([code, name], i) => {
  const row = { id: uid("ca70"), code, name, parent_id: null, is_active: code !== "FUR", sort_order: i, created_at: daysAgo(600) };
  cat[code] = row.id;
  T("categories").push(row);
});

const LOCATIONS = [
  ["GAL", "Gallery, ground floor", "gallery", null],
  ["GAL-B", "Gallery, basement store", "storage", "Racks 1 to 6; paintings flat in plan chests"],
  ["STO", "Off-site store, Park Royal", "storage", "Climate-controlled bay 14"],
  ["TEFAF", "TEFAF Maastricht stand", "fair", null],
  ["FRZ", "Frieze Masters stand", "fair", null],
  ["RES", "Restorer", "restorer", "Bamboo and lacquer repairs"],
  ["CON", "With consignee", "consignee", null],
  ["AUC", "At auction", "auction", null],
];
const loc = {};
LOCATIONS.forEach(([code, name, type, notes], i) => {
  const row = { id: uid("10c0"), code, name, type, notes, sort_order: i, created_at: daysAgo(600) };
  loc[code] = row.id;
  T("locations").push(row);
});

["Japan", "India", "India (Rajasthan)", "India (Odisha)", "Nepal", "Tibet", "Korea", "China"].forEach((name, i) =>
  T("origin_regions").push({ id: uid("0b00"), name, sort_order: i, is_active: true, created_at: daysAgo(500) }),
);

// ------------------------------------------------------------------ makers

// [display, native, romanized, life dates, region, category codes, web]
const MAKERS = [
  ["Shiotsuki Juran", "塩月寿籃", "Shiotsuki Juran", "1948–2016", "Japan", ["BAM"], true],
  ["Yokota Yōsai", null, "Yokota Yosai", "1899–1975", "Japan", ["BAM"], true],
  ["Takahashi Isshunsai", null, "Takahashi Isshunsai", "1899–1958", "Japan", ["BAM"], true],
  ["Yamamoto Jirō", null, "Yamamoto Jiro", "1897–1954", "Japan", ["BAM"], true],
  ["Hatanaka Hōzan", null, "Hatanaka Hozan", "1904–1991", "Japan", ["BAM"], true],
  ["Suga Chikujinsai", null, "Suga Chikujinsai", "b. 1940", "Japan", ["BAM"], true],
  ["Midorikawa Kiseki", null, "Midorikawa Kiseki", "1943–2014", "Japan", ["BAM"], false],
  ["Kawachi Kōmei", null, "Kawachi Komei", "b. 1932", "Japan", ["BAM", "WOO"], true],
  ["Ozawa Kōmin", null, "Ozawa Komin", "b. 1941", "Japan", ["BAM"], true],
  ["Honma Takusai IV", "本間琢斎", "Honma Takusai", "1893–1967", "Japan", ["MET"], true],
  ["Kiyomizu Rokubei VI", "清水六兵衛", "Kiyomizu Rokubei", "1901–1980", "Japan", ["CER"], true],
  ["Yamada Hikaru", "山田光", "Yamada Hikaru", "1923–2001", "Japan", ["CER"], true],
  ["Sugai Kumi", "菅井汲", "Sugai Kumi", "1919–1996", "Japan", ["WOP", "PNT"], true],
  ["Lee Ufan", "李禹煥", "Lee Ufan", "b. 1936", "Korea", ["WOP"], true],
  ["Unno Takeo", null, "Unno Takeo", "1905–1982", "Japan", ["LAC"], true],
  ["Tanaka Mitsuteru", null, "Tanaka Mitsuteru", "1905–1983", "Japan", ["LAC"], true],
  ["Matsuo Tadatsugu", null, "Matsuo Tadatsugu", "1909–2004", "Japan", ["CER"], false],
  ["Nakajima Masao", null, "Nakajima Masao", "1921–2014", "Japan", ["PHO", "WOP"], true],
  ["Saegusa Sōtarō", null, "Saegusa Sotaro", "1911–2006", "Japan", ["PNT"], true],
  ["Tsuda Eiju", null, "Tsuda Eiju", "1915–2001", "Japan", ["WOP"], true],
  ["Yagisawa Sōkan", null, "Yagisawa Sokan", "1927–2006", "Japan", ["LAC"], true],
  ["Shimazaki Shōjirō", null, "Shimazaki Shojiro", "1913–2001", "Japan", ["MET"], true],
  ["Makita Hisayoshi", null, "Makita Hisayoshi", "1906–1997", "Japan", ["SCU"], true],
  ["Ichihashi Toshio", null, "Ichihashi Toshio", "1919–2005", "Japan", ["CER"], true],
  ["Acharya Vyakul", null, "Acharya Vyakul", "1930–2000", "India (Rajasthan)", ["TAN"], true],
  ["Badrinath Pandit", null, "Badrinath Pandit", "c. 1915–1999", "India", ["MAN", "TAN"], true],
  ["Kalu Ram", null, "Kalu Ram", "1940s–2010", "India (Rajasthan)", ["TAN"], true],
  ["Prafulla Mohanti", null, "Prafulla Mohanti", "b. 1936", "India (Odisha)", ["PNT", "WOP"], true],
  ["Sayed Haider Raza", null, "Sayed Haider Raza", "1922–2016", "India", ["PNT", "WOP"], true],
  // No works in stock: the maker list must cope with an empty maker.
  ["Hori Joshin", null, "Hori Joshin", "1907–1993", "Japan", [], false],
];
const makers = MAKERS.map(([display, native, romanized, life, region, cats, web], i) => {
  const id = uid("3a6e");
  const hasPortrait = i % 3 === 0 && i < 27;
  const row = {
    id,
    display_name: display,
    native_name: native,
    romanized_name: romanized,
    alt_names: [],
    school_or_workshop: null,
    life_dates: life,
    region,
    biography: null,
    notes: i === 6 ? "Spelling to check against the 2019 catalogue." : null,
    created_at: daysAgo(560 - i * 3),
    updated_at: daysAgo(40 - (i % 30)),
    portrait_path: hasPortrait ? `${id}/portrait.jpg` : null,
    portrait_original_path: hasPortrait ? `${id}/portrait-original.jpg` : null,
    profile_html:
      i < 6 || i === 24
        ? `<p>Placeholder profile for the studio preview. The gallery has shown work by ${display} in its catalogues of ${region === "Japan" ? "twentieth-century Japanese art" : "Indian art"}; the real text is written in the studio and published to the artist page.</p><p>A second paragraph, so the editor shows more than one block.</p>`
        : null,
    web_visible: web,
    portrait_focus: hasPortrait ? { x: 0.5, y: 0.36 } : null,
    __cats: cats,
  };
  T("makers").push(row);
  return row;
});

// ---------------------------------------------------------------- contacts

const FIRST = {
  gb: ["Alice", "Edward", "Clara", "Rupert", "Imogen", "Henry", "Lucy", "Oliver", "Beatrice", "Hugo", "Florence", "Arthur", "Matilda", "Theo", "Rosalind", "Felix"],
  nl: ["Joris", "Sanne", "Pieter", "Femke", "Maarten", "Lotte", "Willem", "Annelies"],
  jp: ["Kenji", "Yuko", "Haruki", "Aiko", "Takeshi", "Mariko", "Daisuke", "Naomi", "Shun", "Keiko"],
  in: ["Ananya", "Vikram", "Meera", "Arjun", "Priya", "Rohan", "Kavita", "Siddharth"],
  us: ["Margaret", "Daniel", "Caroline", "Jonathan", "Eleanor", "Marcus", "Abigail", "Nathan"],
  fr: ["Hélène", "Mathieu", "Camille", "Étienne", "Sophie", "Laurent"],
  de: ["Katharina", "Lukas", "Johanna", "Matthias", "Franziska", "Tobias"],
  ch: ["Annina", "Reto", "Seraina", "Urs"],
  hk: ["Wing", "Ka-man", "Jun", "Mei"],
};
const LAST = {
  gb: ["Ashworth", "Pemberton", "Hollis", "Whitlock", "Fairbairn", "Carrow", "Dunmore", "Ellery", "Thwaite", "Garside", "Penhallow", "Rainsford", "Larkham", "Strand", "Quennell", "Bewick"],
  nl: ["van Eijk", "de Groot", "Verhoeven", "Bakker", "van der Linde", "Kuipers", "Mulder"],
  jp: ["Moriyama", "Tanabe", "Kuroda", "Hasegawa", "Ishikawa", "Fujimoto", "Sakamoto", "Nishida", "Ogawa"],
  in: ["Rao", "Mehta", "Iyer", "Kapoor", "Banerjee", "Desai", "Nair", "Chandra"],
  us: ["Whitaker", "Calloway", "Brennan", "Hargrove", "Lindqvist", "Ostrander", "Pell"],
  fr: ["Delacroix-Morel", "Aubert", "Fontaine", "Marchetti", "Roussel"],
  de: ["Brandt", "Vogel", "Hoffmann", "Krämer", "Lindner"],
  ch: ["Gerber", "Ammann", "Caflisch"],
  hk: ["Chan", "Leung", "Wong", "Lau"],
};
const PLACES = {
  gb: [["London", "United Kingdom"], ["London", "United Kingdom"], ["London", "United Kingdom"], ["Edinburgh", "United Kingdom"], ["Bath", "United Kingdom"], ["Oxford", "United Kingdom"]],
  nl: [["Amsterdam", "Netherlands"], ["The Hague", "Netherlands"], ["Utrecht", "Netherlands"]],
  jp: [["Tokyo", "Japan"], ["Kyoto", "Japan"], ["Osaka", "Japan"]],
  in: [["Mumbai", "India"], ["New Delhi", "India"], ["Jaipur", "India"], ["London", "United Kingdom"]],
  us: [["New York", "United States"], ["Los Angeles", "United States"], ["Chicago", "United States"], ["San Francisco", "United States"]],
  fr: [["Paris", "France"], ["Lyon", "France"]],
  de: [["Berlin", "Germany"], ["Munich", "Germany"], ["Cologne", "Germany"]],
  ch: [["Zurich", "Switzerland"], ["Geneva", "Switzerland"], ["Basel", "Switzerland"]],
  hk: [["Hong Kong", "Hong Kong"], ["Singapore", "Singapore"]],
};
// Streets that exist nowhere; with a ZZ postcode no address can be real.
const STREETS = ["Quillan Mews", "Ferrowby Lane", "Saltmarren Road", "Ambleforth Square", "Kestrelwick Gardens", "Hollowmere Street", "Brackenvale Row", "Tidewick Place", "Larchholt Avenue", "Cindercombe Walk"];
const REGION_WEIGHT = ["gb", "gb", "gb", "gb", "gb", "nl", "nl", "jp", "jp", "in", "in", "us", "us", "us", "fr", "de", "ch", "hk"];
const INTERESTS = ["Japanese bamboo", "Japanese ceramics", "Japanese lacquer", "Tantric painting", "Indian painting", "Mingei and Showa design", "Works on paper"];

const contacts = [];
const usedEmails = new Set();
let phoneSeq = 100;
function makeContact(over = {}) {
  const region = over.__region ?? pick(REGION_WEIGHT);
  const first = over.first_name ?? pick(FIRST[region]);
  const last = over.last_name ?? pick(LAST[region]);
  const [city, country] = pick(PLACES[region]);
  let email = `${first}.${last}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z.]+/g, "");
  let n = 1;
  while (usedEmails.has(email)) email = `${email.replace(/\d+$/, "")}${++n}`;
  usedEmails.add(email);
  const created = int(30, 2600);
  const isLondon = city === "London";
  phoneSeq += 1;
  const consent = chance(0.62);
  const row = {
    id: uid("c0c7"),
    first_name: first,
    last_name: last,
    salutation: chance(0.25) ? `Dear ${pick(["Mr", "Ms", "Dr", "Mrs"])} ${last}` : null,
    organization_id: null,
    contact_type: pick(["collector", "collector", "collector", "collector", "museum", "dealer", "press", "other"]),
    email: chance(0.93) ? `${email}@example.com` : null,
    phone: chance(0.7) ? (isLondon ? `020 7946 0${String(phoneSeq).padStart(3, "0")}` : `+44 7700 900${String(phoneSeq).padStart(3, "0")}`) : null,
    address_line1: chance(0.6) ? `${int(2, 88)} ${pick(STREETS)}` : null,
    address_line2: null,
    city,
    postcode: country === "United Kingdom" && chance(0.7) ? `ZZ${int(1, 9)} ${int(1, 9)}ZZ` : null,
    country,
    instagram_handle: chance(0.15) ? `@${first.toLowerCase()}.${last.toLowerCase().replace(/\s+/g, "")}.collects` : null,
    whatsapp_number: null,
    line_id: null,
    wechat_id: null,
    tags: chance(0.4) ? [pick(["TEFAF", "Frieze Masters", "Asia Week", "Private viewing", "Lender"])] : [],
    interested_regions: chance(0.5) ? [pick(["Japan", "India"])] : [],
    custom_fields: chance(0.55) ? { interests: [...new Set([pick(INTERESTS), ...(chance(0.4) ? [pick(INTERESTS)] : [])])] } : {},
    marketing_consent: consent,
    consent_date: consent ? dateAgo(int(10, 1500)) : null,
    consent_source: consent ? pick(["Website sign-up", "In person at the gallery", "TEFAF guest book", "Pre-existing (legacy import)"]) : null,
    do_not_mail: false,
    unsubscribed_at: null,
    kyc_status: "not_started",
    sanctions_status: chance(0.3) ? "clear" : null,
    last_screened_at: null,
    notes: chance(0.3) ? pick(["Prefers email to phone.", "Collects bamboo; ask before TEFAF.", "Museum acquisitions committee meets in March.", "Met at Frieze Masters; interested in Sōdeisha ceramics.", "Lends to exhibitions."]) : null,
    created_at: daysAgo(created),
    updated_at: daysAgo(Math.max(1, created - int(0, created))),
    consent_evidence: null,
    consent_confirm_token: null,
    consent_confirm_sent_at: null,
    email_bounced_at: null,
    erased_at: null,
    ...over,
  };
  delete row.__region;
  if (row.sanctions_status) row.last_screened_at = daysAgo(int(5, 300));
  contacts.push(row);
  T("crm_contacts").push(row);
  return row;
}
for (let i = 0; i < 168; i++) makeContact();
// The client whose record the preview opens has a full address and phone.
Object.assign(contacts[0], { phone: "020 7946 0018", address_line1: "7 Quillan Mews", city: "London", postcode: "ZZ1 4ZZ", country: "United Kingdom", marketing_consent: true, consent_source: "In person at the gallery", consent_date: dateAgo(400), notes: "Collects bamboo and Sōdeisha ceramics; prefers a call before fairs." });

// Hand-placed edge cases.
const sanctionsHit = makeContact({ first_name: "Viktor", last_name: "Saldanov", __region: "ch", contact_type: "collector", sanctions_status: "potential_match", kyc_status: "refer", notes: "Screening returned a possible name match; held pending review.", marketing_consent: false, consent_source: null, consent_date: null });
const dupA = makeContact({ first_name: "Eleanor", last_name: "Whitaker", __region: "us", created_at: daysAgo(2100), updated_at: daysAgo(400) });
const dupB = makeContact({ first_name: "Eleanor", last_name: "Whitaker", __region: "us", email: null, phone: null, created_at: daysAgo(1800), updated_at: daysAgo(1800), notes: "Imported twice from the old address book." });
const unsubscribed = makeContact({ first_name: "Lotte", last_name: "Kuipers", __region: "nl", marketing_consent: false, unsubscribed_at: daysAgo(40), consent_source: "Website sign-up" });
const bounced = makeContact({ first_name: "Rupert", last_name: "Fairbairn", __region: "gb", email_bounced_at: daysAgo(12) });
const doNotMail = makeContact({ first_name: "Haruki", last_name: "Nishida", __region: "jp", do_not_mail: true });
const erased = makeContact({ first_name: "Erased", last_name: "contact", email: null, phone: null, address_line1: null, city: null, country: null, notes: null, tags: [], custom_fields: {}, marketing_consent: false, consent_source: null, consent_date: null, erased_at: daysAgo(90), updated_at: daysAgo(90) });
const longName = makeContact({ first_name: "Maximiliane-Charlotte", last_name: "von Hohenstaufen-Delacroix-Morel", __region: "de", email: "maximiliane-charlotte.vonhohenstaufen-delacroix-morel@example.com" });
// Old, no consent, no activity: shows up in the five-year review.
const stale1 = makeContact({ first_name: "Annelies", last_name: "Bakker", __region: "nl", marketing_consent: false, consent_source: null, consent_date: null, created_at: daysAgo(2400), updated_at: daysAgo(2300) });
const stale2 = makeContact({ first_name: "Marcus", last_name: "Ostrander", __region: "us", marketing_consent: false, consent_source: null, consent_date: null, created_at: daysAgo(2500), updated_at: daysAgo(2200) });
// Marketing on the strength of the legacy import note only (weak basis).
const weak1 = makeContact({ first_name: "Caroline", last_name: "Pell", __region: "us", marketing_consent: true, consent_source: "Pre-existing (legacy import)", consent_evidence: null });
const weak2 = makeContact({ first_name: "Urs", last_name: "Ammann", __region: "ch", marketing_consent: true, consent_source: "Imported from FileMaker", consent_evidence: null });
// Attested legacy consent, as the data-protection page reads it.
for (const c of contacts.slice(0, 40)) {
  if (c.consent_source === "Pre-existing (legacy import)") {
    c.consent_evidence = { marketing: { version: "legacy-import", attested_by: USERS.admin.email, attested_at: daysAgo(200) } };
  }
}

const museum = contacts.filter((c) => c.contact_type === "museum");
const collectors = contacts.filter((c) => c.contact_type === "collector" && c.email && !c.erased_at);

T("crm_organizations").push(
  { id: uid("0a90"), name: "Hollowmere Museum of Asian Art", org_type: "museum", website: null, address_line1: null, address_line2: null, city: "Amsterdam", postcode: null, country: "Netherlands", notes: null, created_at: daysAgo(900), updated_at: daysAgo(100) },
);

contacts.slice(0, 30).forEach((c, i) => {
  if (i % 3 === 0)
    T("crm_interactions").push({
      id: uid("1a7e"),
      contact_id: c.id,
      user_id: i % 2 ? ADMIN : STAFF,
      kind: pick(["call", "email", "meeting", "note"]),
      note: pick(["Discussed the bamboo baskets for TEFAF.", "Sent images of two tantric paintings.", "Visited the gallery with a friend.", "Asked for a condition report."]),
      happened_at: daysAgo(int(2, 200)),
      created_at: daysAgo(int(2, 200)),
    });
});

// ------------------------------------------------------------------- works

const BAMBOO_TITLES = [
  "Flower basket, 'Autumn Wind'",
  "Ikebana basket with tall arching handle",
  "Boat-shaped flower basket",
  "Plaited madake basket with rattan rim",
  "Sculptural bamboo form, 'Wave'",
  "Hanging flower basket in the form of a gourd",
  "Tea ceremony basket, 'Moon over the River'",
  "Square bamboo basket with lacquered interior",
  "Openwork bamboo vessel",
  "Flower basket with twisted rattan binding",
  "Low tray basket, plaited susudake",
  "Tall vase-form basket, 'Spring Rain'",
];
const TITLES = {
  BAM: BAMBOO_TITLES,
  CER: ["Black-glazed stoneware object", "Vase with ash glaze", "Sōdeisha sculpture, stoneware", "Tea bowl with white slip", "Faceted porcelain vase"],
  LAC: ["Red lacquer ikebana vase", "Black lacquer box with maki-e cranes", "Set of five red lacquer plates", "Dry-lacquer bowl"],
  MET: ["Bronze vase with wave pattern", "Murashido bronze flower vessel", "Iron kettle for the tea ceremony", "Silver-inlaid bronze dish"],
  PNT: ["Untitled abstraction", "Landscape with red sun", "Bindu", "Composition in black and ochre", "Village scene, Odisha"],
  TAN: ["Tantric painting, Shiva lingam", "Tantric painting, the cosmic egg", "Shri Yantra", "Kundalini chakra diagram", "Tantric painting, three bands of colour", "Shiva and Shakti, abstract form"],
  WOP: ["Untitled (Autoroute)", "From Point", "Ink study, brushed circle", "Woodblock print, red and blue", "Composition on Japanese paper"],
  MAN: ["Manuscript page dedicated to various salagram forms, with sacred marks representing different manifestations of Vishnu", "Astrological manuscript page", "Jain cosmological diagram"],
  TEX: ["Indigo boro textile", "Kantha embroidered cloth"],
  SCU: ["Carved wood sculpture", "Bronze abstract form"],
  WOO: ["Carved and polished wooden bowl", "Inlaid wooden box"],
  PHO: ["Gelatin silver print, Kyoto street", "Silver print, bamboo grove"],
};
const MEDIUM = {
  BAM: ["Madake bamboo and rattan", "Bamboo, rattan and lacquer", "Smoked bamboo and rattan"],
  CER: ["Stoneware with black glaze", "Stoneware with ash glaze", "Porcelain"],
  LAC: ["Red lacquer on wood", "Black lacquer with gold maki-e", "Dry lacquer (kanshitsu)"],
  MET: ["Bronze", "Cast iron", "Bronze with silver inlay"],
  PNT: ["Oil on canvas", "Acrylic on canvas", "Gouache on paper"],
  TAN: ["Gouache on paper", "Gouache and ink on paper", "Gouache on recycled paper"],
  WOP: ["Lithograph", "Ink on Japanese paper", "Woodblock print", "Screenprint"],
  MAN: ["Gouache and ink on paper"],
  TEX: ["Indigo-dyed cotton", "Cotton with running stitch"],
  SCU: ["Wood", "Bronze"],
  WOO: ["Zelkova wood", "Wood with mother-of-pearl inlay"],
  PHO: ["Gelatin silver print"],
};
const PERIOD = { jp: ["Shōwa period", "Shōwa period, 1950s", "Heisei period", "Taishō period"], in: ["20th century", "Late 20th century", "c. 1970s"] };
const SCENE = { BAM: "basket", CER: "object", LAC: "object", MET: "object", SCU: "object", WOO: "object", TEX: "flat", PNT: "flat", TAN: "flat", WOP: "flat", MAN: "flat", PHO: "flat" };

const STATUS_PLAN = [
  ...Array(58).fill("in_stock"),
  ...Array(6).fill("reserved"),
  ...Array(7).fill("consigned_in"),
  ...Array(5).fill("consigned_out"),
  ...Array(24).fill("sold"),
  ...Array(2).fill("gifted"),
  ...Array(3).fill("returned"),
  ...Array(2).fill("written_off"),
];

const pieces = [];
const external = [];
const piecesByMaker = new Map();
let seqByYear = {};

function stockNumber(year, ledger) {
  const key = `${ledger}:${year}`;
  seqByYear[key] = (seqByYear[key] ?? 0) + 1;
  const n = String(seqByYear[key]).padStart(4, "0");
  return ledger === "external" ? `X-${year}-${n}` : `${year}-${n}`;
}

function dims(code) {
  const flat = ["PNT", "TAN", "WOP", "MAN", "PHO", "TEX"].includes(code);
  if (flat) {
    const h = int(20, 110);
    const w = int(15, 90);
    return { height_cm: h, width_cm: w, depth_cm: null, diameter_cm: null };
  }
  if (code === "BAM") return { height_cm: int(25, 70), width_cm: int(18, 45), depth_cm: int(15, 40), diameter_cm: null };
  if (code === "CER" || code === "MET") return chance(0.5) ? { height_cm: int(12, 45), width_cm: null, depth_cm: null, diameter_cm: int(10, 35) } : { height_cm: int(12, 45), width_cm: int(10, 30), depth_cm: int(10, 30), diameter_cm: null };
  return { height_cm: int(6, 40), width_cm: int(10, 50), depth_cm: int(8, 40), diameter_cm: null };
}

function makePiece(i, ledger) {
  // Makers: about one in seven works is anonymous.
  const anonymous = i % 7 === 3;
  const maker = anonymous ? null : makers[(i * 7 + 3) % 29];
  const code = maker ? maker.__cats[i % maker.__cats.length] : pick(["LAC", "MET", "TEX", "SCU", "WOO", "TAN"]);
  const region = maker ? (maker.region.startsWith("India") ? "in" : "jp") : ["TAN", "TEX"].includes(code) ? "in" : "jp";
  const year = ledger === "external" ? pick([2025, 2026]) : 2019 + (i % 8);
  const createdDays = Math.max(3, (2026 - year) * 340 + int(0, 200));
  const status = ledger === "external" ? pick(["in_stock", "consigned_in", "consigned_in", "reserved"]) : STATUS_PLAN[i % STATUS_PLAN.length];
  const titles = TITLES[code];
  let title = titles[i % titles.length];
  const id = uid(ledger === "external" ? "e7e7" : "b1ec");
  const d = dims(code);
  const framed = ["PNT", "TAN", "WOP", "PHO"].includes(code) && chance(0.45);
  const row = {
    id,
    stock_number: stockNumber(year, ledger),
    legacy_stock_number: year < 2022 && chance(0.6) ? `${region === "in" ? "I" : "J"}${int(1200, 5900)}` : null,
    legacy_stock_number_conflict: false,
    title,
    maker_id: maker?.id ?? null,
    attribution_qualifier: anonymous ? null : chance(0.06) ? "attributed to" : null,
    category_id: cat[code],
    medium: pick(MEDIUM[code]),
    period: pick(PERIOD[region]),
    origin_region: region === "in" ? pick(["India", "India (Rajasthan)", "India (Odisha)"]) : "Japan",
    description: chance(0.7)
      ? `${title}. ${region === "jp" ? "Signed on the base; with a fitted wood box (tomobako) inscribed by the artist." : "From a group of works on paper made for private meditation."} Placeholder catalogue text for the studio preview.`
      : null,
    condition_report: chance(0.4) ? pick(["Good overall condition; minor surface wear consistent with age.", "Small repair to the rim, stable.", "Light foxing to the margins.", "Excellent condition."]) : null,
    signature_inscription: region === "jp" && chance(0.5) ? "Signed and sealed" : null,
    box_type: region === "jp" && ["BAM", "CER", "MET", "LAC"].includes(code) ? pick(["tomobako", "original box", null]) : null,
    box_notes: null,
    ...d,
    length_cm: null,
    weight_g: chance(0.2) ? int(200, 4000) : null,
    dimensions_display: null,
    status,
    location_id: status === "sold" || status === "gifted" ? null : status === "consigned_out" ? loc.CON : pick([loc.GAL, loc.GAL, loc["GAL-B"], loc.STO, loc.STO, loc.RES]),
    photographer: chance(0.3) ? "Studio photograph" : null,
    comments: null,
    tags: chance(0.3) ? [pick(["TEFAF 2027", "Frieze Masters", "Catalogue", "Website feature"])] : [],
    ai_suggestions: null,
    web_visible: status === "in_stock" || status === "reserved" ? chance(0.7) : status === "sold" ? chance(0.2) : false,
    created_by: chance(0.6) ? ADMIN : STAFF,
    updated_by: chance(0.5) ? ADMIN : STAFF,
    created_at: daysAgo(createdDays),
    updated_at: daysAgo(int(1, Math.min(createdDays, 120))),
    source_note: null,
    published_note: null,
    shares_note: null,
    consignment_details: null,
    purchased_from: null,
    sold_to: null,
    document_note: null,
    legacy_modified_at: null,
    legacy_modified_by: null,
    deleted_at: null,
    year: pick(["1950s", "c. 1930", "1964", "1972", "1980s", "c. 1975", "1958", null, "1991", "2004"]),
    publications: chance(0.15) ? "Illustrated in the gallery's 2019 catalogue, no. 12." : null,
    exhibitions: chance(0.15) ? "TEFAF Maastricht, 2023" : null,
    needs_completion: false,
    consignment_share_pct: null,
    sale_handled_by_jvb: null,
    consignee_contact_id: null,
    ledger,
    framed,
    unframed_height_cm: framed ? Math.max(5, d.height_cm - 12) : null,
    unframed_width_cm: framed && d.width_cm ? Math.max(5, d.width_cm - 10) : null,
    unframed_depth_cm: null,
    unframed_length_cm: null,
    unframed_diameter_cm: null,
    unframed_weight_g: null,
    presentation: chance(0.15) ? pick(["flat", "object", "photo"]) : "auto",
    search_vector: null,
    __code: code,
  };
  return row;
}

for (let i = 0; i < 112; i++) {
  const p = makePiece(i, "jvb");
  pieces.push(p);
}
for (let i = 0; i < 12; i++) external.push(makePiece(200 + i, "external"));

// Edge cases on specific works.
const longTitle = pieces[5];
longTitle.title = "Exceptionally large bamboo flower basket of plaited and twisted madake with a rattan-bound rim and a tall arching handle, in its original fitted wood box (tomobako) signed and sealed by the artist";
longTitle.__code = "BAM";
longTitle.category_id = cat.BAM;
longTitle.maker_id = makers[0].id;
longTitle.status = "in_stock";
longTitle.medium = "Madake bamboo and rattan";
longTitle.origin_region = "Japan";
longTitle.period = "Shōwa period, 1950s";
const manuscript = pieces.find((p) => p.maker_id === makers[25].id) ?? pieces[25];
manuscript.title = TITLES.MAN[0];

// Needs completion: drafts missing key fields.
for (const p of pieces.filter((x) => x.status === "in_stock").slice(-8)) {
  p.needs_completion = true;
  p.description = null;
  if (chance(0.5)) p.medium = null;
}
const blankDraft = pieces[pieces.length - 1];
Object.assign(blankDraft, { title: null, maker_id: null, medium: null, period: null, year: null, description: null, needs_completion: true, web_visible: false, created_at: daysAgo(1), updated_at: daysAgo(1) });

// Consignment and co-ownership.
const consignors = collectors.slice(10, 16);
pieces
  .filter((p) => p.status === "consigned_in")
  .forEach((p, i) => {
    p.consignee_contact_id = consignors[i % consignors.length].id;
    p.consignment_share_pct = pick([50, 60, 70]);
    p.sale_handled_by_jvb = true;
    p.consignment_details = "Consigned for sale; owner's minimum agreed by email.";
  });
pieces
  .filter((p) => p.status === "sold")
  .slice(0, 2)
  .forEach((p) => {
    p.shares_note = "Half share with a private collector";
    p.consignment_share_pct = 50;
    p.sale_handled_by_jvb = true;
  });
for (const p of external) {
  p.consignee_contact_id = pick(consignors).id;
  p.consignment_details = "Held for a private owner; not JvdB stock.";
}

// Trash: soft-deleted works.
pieces.slice(60, 64).forEach((p, i) => {
  p.deleted_at = daysAgo(3 + i * 5);
});
external[11].deleted_at = daysAgo(9);

// Legacy number conflict (migration page).
pieces[2].legacy_stock_number = "J3051";
pieces[2].legacy_stock_number_conflict = true;
pieces[9].legacy_stock_number = "J3051";
pieces[9].legacy_stock_number_conflict = true;

for (const p of [...pieces, ...external]) {
  if (!piecesByMaker.has(p.maker_id)) piecesByMaker.set(p.maker_id, []);
  piecesByMaker.get(p.maker_id).push(p);
}

// ------------------------------------------------------------ financials

const CURRENCY = [["GBP", 1], ["GBP", 1], ["JPY", 0.0052], ["EUR", 0.85], ["USD", 0.78]];
const sellers = collectors.slice(20, 40);
const buyers = collectors.slice(40, 70);
const fins = [];
pieces.forEach((p, i) => {
  if (i === pieces.length - 1) return; // the blank draft has no financials yet
  const [cur, fx] = pick(CURRENCY);
  // Works on paper and tantric paintings sell for less than baskets and bronzes.
  const paper = [cat.TAN, cat.WOP, cat.MAN, cat.PHO].includes(p.category_id);
  const purchaseGbp = round(paper ? int(300, 4200) : int(600, 16000), 50);
  const purchase = cur === "GBP" ? purchaseGbp : round(purchaseGbp / fx, cur === "JPY" ? 10000 : 50);
  const marked = chance(0.88) ? round(purchaseGbp * (1.6 + rnd() * 1.6), 250) : null; // some null prices
  const vat = i % 13 === 0 ? "standard" : i % 17 === 0 ? "zero_rated" : i % 23 === 0 ? "outside_scope" : "margin_scheme";
  const purchaseDays = Math.max(5, Math.round((Date.parse(ANCHOR) - Date.parse(p.created_at)) / DAY) + int(0, 40));
  const f = {
    piece_id: p.id,
    purchase_date: dateAgo(purchaseDays),
    purchase_cost: purchase,
    purchase_currency: cur,
    purchase_fx: cur === "GBP" ? 1 : fx,
    purchase_cost_gbp: purchaseGbp,
    purchase_invoice_document_id: null,
    seller_contact_id: chance(0.7) ? pick(sellers).id : null,
    restoration_cost_gbp: chance(0.2) ? round(int(100, 1200), 10) : null,
    other_costs_gbp: chance(0.3) ? round(int(50, 600), 10) : null,
    total_cost_gbp: null,
    marked_price_gbp: marked,
    sold_date: null,
    sold_price: null,
    sell_currency: null,
    sell_fx: null,
    sold_price_gbp: null,
    sale_invoice_document_id: null,
    buyer_contact_id: null,
    vat_treatment: vat,
    vat_review_needed: i % 31 === 0,
    consignment_id: null,
    margin_gbp: null,
    updated_at: p.updated_at,
    net_profit_gbp: null,
    legacy_profit_gbp: null,
    import_type: i % 9 === 0 ? pick(["import_vat_paid", "import_vat_deferred", "temporary_import"]) : null,
    import_vat_gbp: null,
  };
  if (f.import_type === "import_vat_paid") f.import_vat_gbp = Math.round(purchaseGbp * 0.05);
  if (p.status === "sold" || p.status === "gifted") {
    const soldDays = int(3, Math.max(4, Math.min(purchaseDays - 1, 700)));
    const sold = p.status === "gifted" ? 0 : round((marked ?? purchaseGbp * 2) * (0.85 + rnd() * 0.2), 250);
    Object.assign(f, {
      sold_date: dateAgo(soldDays),
      sold_price: sold,
      sell_currency: "GBP",
      sell_fx: 1,
      sold_price_gbp: sold,
      buyer_contact_id: pick(buyers).id,
    });
    p.sold_to = null;
  }
  fins.push(f);
});
// A negative margin: sold below cost.
const loss = pieces.find((p) => p.status === "sold");
const lossFin = fins.find((f) => f.piece_id === loss.id);
Object.assign(lossFin, { purchase_cost: 14500, purchase_currency: "GBP", purchase_fx: 1, purchase_cost_gbp: 14500, marked_price_gbp: 16000, sold_price: 11000, sold_price_gbp: 11000, vat_treatment: "margin_scheme" });
loss.comments = "Sold below cost to a long-standing client after restoration costs ran over.";
// The client whose record the preview opens has bought, enquired and been offered works.
lossFin.buyer_contact_id = collectors[0].id;
// Sold works whose mis-recorded purchase £ was cleared (Needs purchase £).
const clearedSold = pieces.filter((p) => p.status === "sold").slice(3, 5);
for (const p of clearedSold) {
  const f = fins.find((x) => x.piece_id === p.id);
  T("purchase_gbp_cleared").push({ piece_id: p.id, cleared_value: f.purchase_cost, purchase_cost: f.purchase_cost, currency: "JPY", cleared_at: daysAgo(160) });
  Object.assign(f, { purchase_currency: "JPY", purchase_cost: 2400000, purchase_cost_gbp: null, purchase_fx: null });
}
// Recent sales so the dashboard's month and quarter figures are not empty.
pieces
  .filter((p) => p.status === "sold")
  .slice(5, 9)
  .forEach((p, i) => {
    const f = fins.find((x) => x.piece_id === p.id);
    f.sold_date = dateAgo(4 + i * 6);
  });
// computeFinancials, inline (the mock recomputes on every write).
for (const f of fins) {
  const purchase = f.purchase_cost_gbp;
  const extra = (f.restoration_cost_gbp ?? 0) + (f.other_costs_gbp ?? 0);
  f.total_cost_gbp = purchase == null && !extra ? null : (purchase ?? 0) + extra;
  f.margin_gbp = f.sold_price_gbp != null && f.total_cost_gbp != null ? f.sold_price_gbp - f.total_cost_gbp : null;
  if (f.sold_price_gbp != null && f.total_cost_gbp != null) {
    const vat = f.vat_treatment === "standard" ? f.sold_price_gbp / 6 : f.vat_treatment === "margin_scheme" ? Math.max(f.margin_gbp, 0) / 6 : 0;
    f.net_profit_gbp = Math.round((f.sold_price_gbp - vat - f.total_cost_gbp) * 100) / 100;
  }
}
T("piece_financials").push(...fins);

T("consignments").push({
  id: uid("c045"),
  direction: "in",
  counterparty_contact_id: consignors[0].id,
  start_date: dateAgo(300),
  end_date: dateAgo(-60),
  revenue_split_pct: 60,
  terms: "Sixty per cent to the consignor on sale; insurance by the gallery.",
  created_at: daysAgo(300),
});

T("exchange_rates").push(
  { base: "GBP", quote: "JPY", rate: 192.4, as_of: dateAgo(1) },
  { base: "GBP", quote: "EUR", rate: 1.176, as_of: dateAgo(1) },
  { base: "GBP", quote: "USD", rate: 1.281, as_of: dateAgo(1) },
);

// ----------------------------------------------------------------- images

// Works without images: every ninth (spread across the years), plus the blank draft.
const ASPECTS = [
  [3000, 4000],
  [4000, 3000],
  [3600, 3600],
  [2800, 4200],
  [4096, 2730],
  [3000, 3000],
];
const ROLES = ["front", "back", "side", "signature", "box", "detail"];
const images = [];
for (const p of [...pieces, ...external]) {
  const idx = pieces.indexOf(p);
  if (p === blankDraft || (idx >= 0 && idx % 9 === 4)) continue;
  const n = int(1, 5);
  const [w, h] = p.__code === "BAM" || p.__code === "CER" ? pick([[3000, 4000], [3600, 3600], [2800, 4200]]) : pick(ASPECTS);
  for (let k = 0; k < n; k++) {
    const id = uid("1a6e");
    const role = k === 0 ? "front" : ROLES[k % ROLES.length];
    const rot = k > 0 && chance(0.4);
    const row = {
      id,
      piece_id: p.id,
      role,
      caption: k === 0 ? null : chance(0.3) ? "Detail of the signature" : null,
      sort_order: k,
      storage_path_original: `${p.id}/${id}.jpg`,
      storage_path_display: `${p.id}/${id}.display.jpg`,
      width: rot ? h : w,
      height: rot ? w : h,
      file_size_bytes: int(800_000, 6_000_000),
      exif: null,
      processing_status: "done",
      processing_error: null,
      legacy_container_filename: null,
      created_by: ADMIN,
      created_at: daysAgo(int(2, 300)),
      rotation: 0,
      // Scene hint for the mock's placeholder drawing; never sent to the studio.
      __scene: k === 0 ? (p.presentation === "photo" ? "room" : SCENE[p.__code] ?? "object") : pick(["object", "flat", "basket"]),
    };
    images.push(row);
  }
}
// One still processing, one that failed.
const procImg = images.find((im) => im.piece_id === pieces[3].id && im.sort_order === 0);
if (procImg) {
  const extra = { ...procImg, id: uid("1a6e"), sort_order: 9, role: "detail", storage_path_display: null, processing_status: "processing" };
  images.push(extra);
}
const errImg = { ...images[0], id: uid("1a6e"), sort_order: 10, role: "other", storage_path_display: null, processing_status: "error", processing_error: "Could not read HEIC file: unsupported compression." , legacy_container_filename: "IMG_4471.HEIC" };
images.push(errImg);
T("piece_images").push(...images);

// Squares: the website-tile guess for the first image of some works.
for (const im of images.filter((x) => x.sort_order === 0).slice(0, 40)) {
  const kind = im.__scene === "flat" ? "flat" : im.__scene === "room" ? "photo" : "object";
  T("piece_image_squares").push({
    image_id: im.id,
    guess: kind,
    kind,
    square_path: kind === "flat" ? null : `${im.piece_id}/${im.id}.sq-1600x1600.jpg`,
    source_width: im.width,
    source_height: im.height,
    box: null,
    rendered_at: daysAgo(10),
    flat_hint: kind === "flat",
  });
}

// ------------------------------------------------------ provenance, history

for (const p of pieces.slice(0, 50)) {
  if (!chance(0.5)) continue;
  const n = int(1, 3);
  for (let k = 0; k < n; k++) {
    T("provenance_entries").push({
      id: uid("9e0e"),
      piece_id: p.id,
      sort_order: k,
      date_text: pick(["c. 1960", "1970s", "1985", "by 1992", "2004"]),
      party: pick(["Private collection, Kyoto", "Private collection, London", "Acquired from the artist", "Private collection, Amsterdam", "Private collection, Jaipur"]),
      event_type: pick(["acquired", "by descent", "exhibited", null]),
      details: chance(0.4) ? "With a letter from the previous owner." : null,
      is_public: chance(0.7),
      created_at: p.created_at,
    });
  }
}
for (const p of pieces.slice(0, 30)) {
  if (!chance(0.4)) continue;
  T("piece_location_history").push({
    id: uid("10c4"),
    piece_id: p.id,
    from_location_id: loc.STO,
    to_location_id: p.location_id ?? loc.GAL,
    moved_at: daysAgo(int(5, 200)),
    moved_by: STAFF,
    note: chance(0.5) ? "For the autumn hang." : null,
  });
}

// Change history: creation plus a few field edits.
let actSeq = 0;
for (const p of pieces.slice(0, 40)) {
  T("activity_log").push({ id: ++actSeq, actor_id: p.created_by, entity_type: "pieces", entity_id: p.id, action: "INSERT", changes: null, created_at: p.created_at });
  if (chance(0.6))
    T("activity_log").push({
      id: ++actSeq,
      actor_id: pick([ADMIN, STAFF]),
      entity_type: "pieces",
      entity_id: p.id,
      action: "UPDATE",
      changes: { title: { old: "Untitled", new: p.title }, status: { old: "in_stock", new: p.status } },
      created_at: daysAgo(int(2, 60)),
    });
  if (chance(0.3))
    T("activity_log").push({
      id: ++actSeq,
      actor_id: ADMIN,
      entity_type: "piece_financials",
      entity_id: p.id,
      action: "UPDATE",
      changes: { marked_price_gbp: { old: 12000, new: 14500 } },
      created_at: daysAgo(int(2, 60)),
    });
}

// A work moved between registers keeps its old number reachable.
const movedPiece = external[0];
T("piece_ledger_moves").push({
  id: uid("1ed9"),
  piece_id: movedPiece.id,
  from_ledger: "jvb",
  to_ledger: "external",
  from_stock_number: "2024-0099",
  to_stock_number: movedPiece.stock_number,
  note: "Belongs to the consignor; moved off JvdB stock.",
  moved_by: ADMIN,
  moved_at: daysAgo(80),
});

// Flags and watches, per user.
pieces.slice(10, 13).forEach((p) => T("piece_flags").push({ user_id: ADMIN, piece_id: p.id, created_at: daysAgo(2) }));
T("piece_flags").push({ user_id: STAFF, piece_id: pieces[20].id, created_at: daysAgo(1) });
pieces.slice(0, 2).forEach((p) => T("piece_watches").push({ user_id: ADMIN, piece_id: p.id, created_at: daysAgo(20) }));

// --------------------------------------------------------------- documents

const DOCS = [];
function doc(doc_type, title, over = {}) {
  const row = {
    id: uid("d0c5"),
    piece_id: null,
    doc_type,
    title,
    storage_path: `documents/${counters.d0c5}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.pdf`,
    issued_by: null,
    issued_date: null,
    notes: null,
    uploaded_by: ADMIN,
    created_at: daysAgo(int(5, 400)),
    doc_date: dateAgo(int(5, 400)),
    reference: null,
    ...over,
  };
  DOCS.push(row);
  return row;
}
const invoiceTokyo = doc("purchase_invoice", "Invoice, Tokyo dealer, spring buying trip", { reference: "INV-26-0412", issued_by: "Dealer, Tokyo" });
const saleInvoice = doc("sale_invoice", "Sale invoice 2026-118", { reference: "2026-118" });
const certificate = doc("certificate", "Certificate of authenticity, Kiyomizu Rokubei", { reference: null });
const exportLicence = doc("export_licence", "Export licence for cultural goods", { reference: "EL-2026-77" });
const importDoc = doc("import_document", "C88 import declaration, Tokyo consignment", { reference: "C88-55120" });
const condition = doc("condition_report", "Condition report before restoration");
const unlinked = doc("other", "Letter from the artist's family (not linked to a work)");
const noFile = doc("correspondence", "Note of a telephone call about provenance", { storage_path: null });
const insurance = doc("insurance", "Fine art insurance schedule, TEFAF 2026");
for (let i = 0; i < 10; i++) doc(pick(["purchase_invoice", "sale_invoice", "certificate", "shipping"]), `${pick(["Invoice", "Certificate", "Shipping note", "Receipt"])} ${2025 + (i % 2)}-${String(i + 10).padStart(3, "0")}`);
T("piece_documents").push(...DOCS);
const link = (d, ps) => ps.forEach((p) => T("document_pieces").push({ document_id: d.id, piece_id: p.id, created_at: d.created_at }));
link(invoiceTokyo, pieces.slice(0, 9));
link(saleInvoice, [loss]);
link(certificate, pieces.filter((p) => p.maker_id === makers[10].id).slice(0, 1));
link(exportLicence, pieces.slice(14, 16));
link(importDoc, pieces.slice(0, 6));
link(condition, [pieces[3]]);
link(insurance, pieces.slice(20, 44));
DOCS.slice(9).forEach((d, i) => link(d, [pieces[30 + i]]));
fins.find((f) => f.piece_id === pieces[0].id).purchase_invoice_document_id = invoiceTokyo.id;
lossFin.sale_invoice_document_id = saleInvoice.id;

// --------------------------------------------------------------- shipments

const shipments = [];
function shipment(kind, days, reference, destination, notes = null) {
  const row = { id: uid("5a1b"), kind, shipment_date: dateAgo(days), reference, notes, created_by: ADMIN, created_at: daysAgo(days + 2), updated_at: daysAgo(days), destination_country: destination };
  shipments.push(row);
  return row;
}
const imp1 = shipment("import", 210, "AWB 176-5512 0934", null, "Spring buying trip, Tokyo and Kyoto");
const exp1 = shipment("export", 95, "EORI export 26-0091", "United States");
const tmp1 = shipment("temporary_export", 30, "ATA carnet GB/2026/1187", "Netherlands", "TEFAF Maastricht preview loan");
const tmp2 = shipment("temporary_export", 400, "ATA carnet GB/2025/0410", "Switzerland", "Exhibition loan, returned");
const tImp = shipment("temporary_import", 15, "Temporary admission TA-26-55", null, "Works sent for a private viewing");
const emptyShip = shipment("export", 2, null, null);
T("shipments").push(...shipments);
const ps = (s, list, extra = {}) => list.forEach((p) => T("piece_shipments").push({ piece_id: p.id, shipment_id: s.id, kind: s.kind, created_at: s.created_at, returned_at: null, closed_reason: null, ...extra }));
ps(imp1, pieces.slice(0, 12));
ps(exp1, pieces.filter((p) => p.status === "sold").slice(0, 2));
ps(tmp1, pieces.filter((p) => p.status === "in_stock").slice(2, 7));
ps(tmp2, pieces.slice(40, 43), { returned_at: daysAgo(330) });
ps(tImp, external.slice(1, 3));
T("shipment_documents").push(
  { id: uid("5d0c"), shipment_id: imp1.id, title: "Airway bill", storage_path: `shipments/${imp1.id}/awb.pdf`, created_at: imp1.created_at },
  { id: uid("5d0c"), shipment_id: tmp1.id, title: "ATA carnet", storage_path: `shipments/${tmp1.id}/carnet.pdf`, created_at: tmp1.created_at },
);

// -------------------------------------------------------------- piece lists

function pieceList(name, over = {}) {
  const row = { id: uid("1157"), name, description: null, is_dynamic: false, filter_rules: null, created_by: ADMIN, created_at: daysAgo(int(10, 200)), updated_at: daysAgo(int(1, 10)), sort_order: T("piece_lists").length, web_visible: false, ...over };
  T("piece_lists").push(row);
  return row;
}
const visible = pieces.filter((p) => !p.deleted_at);
const bigList = pieceList("TEFAF Maastricht 2027 shortlist", { description: "Everything we might take; cut to forty by January." });
const hangList = pieceList("Frieze Masters 2026 hang", { description: "As hung on the stand, left to right." });
const webList = pieceList("Bamboo for the website", { web_visible: true, description: "Shown as a list on the website's bamboo page." });
const emptyList = pieceList("Spring catalogue 2027 (empty)");
pieceList("All tantric paintings", { is_dynamic: true, filter_rules: { category: cat.TAN } });
const liveFramed = pieceList("Framed works in storage", { is_dynamic: true, filter_rules: { framed: true, location: loc.STO } });
pieceList("Reserved", { is_dynamic: true, filter_rules: { status: "reserved" } });
pieceList("Not JvdB stock", { is_dynamic: true, filter_rules: { ledger: "external" } });
pieceList("Search: bamboo", { is_dynamic: true, filter_rules: { q: "bamboo" } });
const addItems = (l, list) => list.forEach((p, i) => T("piece_list_items").push({ list_id: l.id, piece_id: p.id, sort_order: i, created_at: l.created_at, excluded: false }));
addItems(bigList, visible.filter((p) => p.status === "in_stock" || p.status === "reserved").slice(0, 64));
addItems(hangList, visible.filter((p) => p.status === "in_stock").slice(10, 28));
addItems(webList, visible.filter((p) => p.category_id === cat.BAM).slice(0, 12));
// A live list with one work pinned out.
const framedInStore = visible.find((p) => p.framed && p.location_id === loc.STO);
if (framedInStore) T("piece_list_items").push({ list_id: liveFramed.id, piece_id: framedInStore.id, sort_order: 0, created_at: daysAgo(3), excluded: true });
void emptyList;

// ---------------------------------------------------------------- CRM lists

function crmList(name, over = {}) {
  const row = { id: uid("c157"), name, description: null, created_by: ADMIN, created_at: daysAgo(int(20, 500)), updated_at: daysAgo(int(1, 20)), is_dynamic: false, filter_rules: null, sort_order: T("crm_lists").length, ...over };
  T("crm_lists").push(row);
  return row;
}
const newsletterList = crmList("Newsletter (everyone who opted in)", { is_dynamic: true, filter_rules: { marketing_consent: true } });
const tefafInvites = crmList("TEFAF 2027 invitations", { description: "Printed card and email." });
const museumList = crmList("Museum curators", { is_dynamic: true, filter_rules: { contact_type: "museum" } });
const pressList = crmList("Press");
crmList("Collectors in the Netherlands", { is_dynamic: true, filter_rules: { country: "Netherlands" } });
crmList("Lenders, 2025 exhibition (empty)");
const members = (l, list) => list.forEach((c) => T("crm_list_members").push({ list_id: l.id, contact_id: c.id, created_at: daysAgo(int(1, 100)) }));
members(tefafInvites, contacts.filter((c) => c.email && !c.erased_at).slice(0, 85));
members(pressList, contacts.filter((c) => c.contact_type === "press"));
void museumList;
INTERESTS.forEach((name, i) => {
  const l = crmList(`Interest: ${name}`, { is_dynamic: true, filter_rules: { interest: name } });
  T("crm_interest_areas").push({ id: uid("1a7a"), name, sort_order: i, created_at: daysAgo(300), list_id: l.id });
});

// --------------------------------------------------------------- campaigns

const design = (heading) => ({
  blocks: [
    { id: "b1", type: "heading", text: heading, level: 1 },
    { id: "b2", type: "text", text: "Dear friends, we are delighted to share a selection of new arrivals ahead of the autumn fairs. Placeholder newsletter copy for the studio preview." },
    {
      id: "b3",
      type: "works",
      items: pieces.slice(0, 3).map((p) => ({ title: p.title ?? "Untitled", maker: makers.find((m) => m.id === p.maker_id)?.display_name ?? undefined, price: "On request" })),
    },
    { id: "b4", type: "button", label: "View the selection", href: "https://joostvandenbergh.com" },
    { id: "b5", type: "divider" },
    { id: "b6", type: "text", text: "The gallery is open by appointment, Tuesday to Friday." },
  ],
});
function campaign(name, status, over = {}) {
  const row = {
    id: uid("ca3a"),
    name,
    subject: over.subject ?? name,
    template_key: null,
    status,
    resend_broadcast_id: null,
    sent_at: null,
    created_by: ADMIN,
    created_at: daysAgo(int(5, 300)),
    updated_at: daysAgo(int(1, 5)),
    design: design(name),
    body_html: null,
    preview_text: "New arrivals and where to find us this autumn",
    from_address: null,
    list_id: newsletterList.id,
    test_sent_at: null,
    ...over,
  };
  T("crm_campaigns").push(row);
  return row;
}
const sentCampaign = campaign("Summer newsletter: Japanese bamboo", "sent", { sent_at: daysAgo(70), list_id: newsletterList.id });
const partCampaign = campaign("TEFAF 2027 invitation", "partial", { list_id: tefafInvites.id, updated_at: daysAgo(1) });
campaign("Autumn arrivals (draft)", "draft", { list_id: newsletterList.id });
campaign("Untitled draft", "draft", { design: null, subject: null, preview_text: null, list_id: null });
const recipients = (c, list, statusFn) =>
  list.forEach((ct, i) => {
    const st = statusFn(i);
    T("crm_campaign_recipients").push({
      id: uid("ca3b"),
      campaign_id: c.id,
      contact_id: ct.id,
      resend_email_id: st === "pending" || st === "failed" ? null : `preview-${counters.ca3b}`,
      status: st,
      opened_at: st === "opened" || st === "clicked" ? daysAgo(68) : null,
      clicked_at: st === "clicked" ? daysAgo(68) : null,
      bounced_at: st === "bounced" ? daysAgo(70) : null,
      unsubscribed_at: null,
      created_at: daysAgo(70),
    });
  });
const optedIn = contacts.filter((c) => c.marketing_consent && c.email && !c.unsubscribed_at && !c.erased_at);
recipients(sentCampaign, optedIn.slice(0, 70), (i) => (i % 11 === 0 ? "bounced" : i % 5 === 0 ? "clicked" : i % 2 === 0 ? "opened" : i % 23 === 0 ? "failed" : "delivered"));
// Part-sent: some mailed, the rest pending, two refused.
recipients(partCampaign, contacts.filter((c) => c.email && !c.erased_at).slice(0, 60), (i) => (i < 34 ? "sent" : i < 36 ? "failed" : "pending"));
T("unsubscribe_tokens").push({ id: uid("0b5b"), contact_id: unsubscribed.id, token: "preview-unsubscribe-token", created_at: daysAgo(70) });

// ------------------------------------------------------------------ offers

function offer(title, kind, over = {}) {
  const row = { id: uid("0ffe"), kind, title, intro: "A small selection chosen with you in mind. Placeholder offer text for the studio preview.", show_prices: true, expires_at: null, created_by: ADMIN, created_at: daysAgo(int(3, 120)), updated_at: daysAgo(1), access_password: null, ...over };
  T("offers").push(row);
  return row;
}
const offerSent = offer("Bamboo baskets for a private collection", "offer", { expires_at: daysAhead(20) });
const offerExpired = offer("Tantric paintings, spring selection", "offer", { expires_at: daysAgo(12) });
const offerDraft = offer("New arrivals from Kyoto (draft)", "offer");
const fairPreview = offer("TEFAF 2027 preview", "fair_preview", { show_prices: false, expires_at: daysAhead(140) });
offer("Viewing room: Sōdeisha ceramics", "viewing_room", { access_password: "kyoto-2026", expires_at: daysAhead(60) });
const offerItems = (o, list) => list.forEach((p, i) => T("offer_items").push({ id: uid("0ff1"), offer_id: o.id, piece_id: p.id, price_override_gbp: i === 0 ? 9500 : null, note: i === 1 ? "Price includes the original box." : null, sort_order: i }));
offerItems(offerSent, visible.filter((p) => p.category_id === cat.BAM && p.status === "in_stock").slice(0, 6));
offerItems(offerExpired, visible.filter((p) => p.category_id === cat.TAN).slice(0, 5));
offerItems(offerDraft, visible.filter((p) => p.status === "in_stock").slice(30, 33));
offerItems(fairPreview, visible.filter((p) => p.status === "in_stock").slice(0, 12));
function offerRecipient(o, c, over = {}) {
  const row = { id: uid("0ff2"), offer_id: o.id, contact_id: c.id, token: `preview-${counters["0ff2"] ?? 0}-${o.id.slice(0, 4)}`, resend_email_id: null, sent_at: null, first_viewed_at: null, last_viewed_at: null, view_count: 0, response: null, responded_at: null, created_at: daysAgo(10), ...over };
  T("offer_recipients").push(row);
  return row;
}
const r1 = offerRecipient(offerSent, collectors[0], { sent_at: daysAgo(6), first_viewed_at: daysAgo(5), last_viewed_at: daysAgo(1), view_count: 4, response: "interested", responded_at: daysAgo(1, 15) });
offerRecipient(offerSent, collectors[1], { sent_at: daysAgo(6), first_viewed_at: daysAgo(6), last_viewed_at: daysAgo(6), view_count: 1 });
offerRecipient(offerSent, collectors[2], { sent_at: daysAgo(6) });
const failedRecipient = offerRecipient(offerSent, collectors[3]);
offerRecipient(offerExpired, collectors[4], { sent_at: daysAgo(40), first_viewed_at: daysAgo(39), view_count: 2, response: "declined", responded_at: daysAgo(38) });
offerRecipient(offerExpired, collectors[5], { sent_at: daysAgo(40) });
for (let i = 0; i < 4; i++)
  T("offer_views").push({ id: i + 1, recipient_id: r1.id, viewed_at: daysAgo(5 - i), ip: "203.0.113.24", user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Safari/605.1.15" });
T("email_events").push(
  { id: 1, provider: "resend", event_type: "failed", payload: { error: "The recipient's mailbox is full." }, campaign_recipient_id: null, offer_recipient_id: failedRecipient.id, created_at: daysAgo(6) },
  { id: 2, provider: "resend", event_type: "email.opened", payload: {}, campaign_recipient_id: T("crm_campaign_recipients")[0].id, offer_recipient_id: null, created_at: daysAgo(68) },
);

// --------------------------------------------------------------- enquiries

const ENQUIRY_MESSAGES = [
  "Could you send the dimensions and a condition report for this basket?",
  "Is this still available? I saw it on your website.",
  "We would like to view this work when we are in London next month.",
  "I'm interested in this piece. Could we arrange a call?",
  "Please could you confirm the price including shipping to New York?",
];
for (let i = 0; i < 14; i++) {
  const p = visible[(i * 9) % visible.length];
  const c = i % 4 === 0 ? collectors[0] : pick(collectors);
  T("enquiries").push({ id: uid("e9a1"), piece_id: i % 5 === 4 ? null : p.id, contact_id: c.id, channel: i % 4 === 0 ? "offer" : pick(["website", "email", "phone"]), message: i % 4 === 0 ? "I'm interested in the second basket; could you hold it until Friday?" : pick(ENQUIRY_MESSAGES), status: pick(["new", "new", "replied", "closed"]), created_at: i % 4 === 0 ? daysAgo(1, 15) : daysAgo(int(1, 120)) });
}

// ------------------------------------------------------------ appointments

const types = [
  { id: uid("a970"), name: "Gallery visit", duration_minutes: 45, location_id: loc.GAL, active: true, created_at: daysAgo(400) },
  { id: uid("a970"), name: "Private viewing", duration_minutes: 90, location_id: loc.GAL, active: true, created_at: daysAgo(400) },
  { id: uid("a970"), name: "Valuation", duration_minutes: 60, location_id: loc.GAL, active: true, created_at: daysAgo(400) },
];
T("appointment_types").push(...types);
function appt(daysFromAnchor, hour, status, over = {}) {
  const starts = daysAhead(daysFromAnchor, hour);
  const type = over.type ?? pick(types);
  const row = {
    id: uid("a971"),
    contact_id: null,
    appointment_type_id: type.id,
    starts_at: starts,
    ends_at: new Date(Date.parse(starts) + type.duration_minutes * 60_000).toISOString(),
    status,
    name: null,
    email: null,
    phone: null,
    notes: null,
    ics_uid: null,
    created_at: daysAgo(Math.max(1, -daysFromAnchor + 7)),
    ...over,
  };
  delete row.type;
  T("appointments").push(row);
  return row;
}
// Requested (from the website, no contact yet) and confirmed, upcoming.
appt(2, 11, "requested", { name: "Joanna Merriweather", email: "joanna.merriweather@example.com", phone: "+44 7700 900871", notes: "Would like to see the bamboo baskets.", type: types[0] });
appt(5, 15, "requested", { name: "Kenta Arakawa", email: "kenta.arakawa@example.com", notes: "Visiting from Osaka for Frieze week." });
appt(1, 14, "confirmed", { contact_id: collectors[6].id, type: types[1], notes: "Bring out the Kiyomizu vases." });
appt(3, 10, "confirmed", { contact_id: collectors[7].id, type: types[0] });
appt(8, 16, "confirmed", { contact_id: museum[0]?.id ?? collectors[8].id, type: types[2] });
appt(-3, 11, "completed", { contact_id: collectors[9].id });
appt(-10, 15, "cancelled", { contact_id: collectors[10].id, notes: "Cancelled by the client, travel changed." });
appt(-20, 12, "no_show", { name: "Daniel Hargrove", email: "daniel.hargrove@example.com" });
appt(-45, 14, "completed", { contact_id: collectors[11].id });

// ------------------------------------------------------- KYC and compliance

const kycProfile = { id: uid("c4c0"), contact_id: buyers[0].id, status: "verified", risk_rating: "low", verified_at: daysAgo(2000), expires_at: daysAgo(170), provider: "Manual", provider_ref: null, created_at: daysAgo(2010), updated_at: daysAgo(2000) };
T("kyc_profiles").push(
  kycProfile,
  { id: uid("c4c0"), contact_id: sanctionsHit.id, status: "refer", risk_rating: "high", verified_at: null, expires_at: null, provider: "Manual", provider_ref: null, created_at: daysAgo(20), updated_at: daysAgo(18) },
  { id: uid("c4c0"), contact_id: buyers[1].id, status: "verified", risk_rating: "low", verified_at: daysAgo(100), expires_at: daysAhead(1725), provider: "Manual", provider_ref: null, created_at: daysAgo(101), updated_at: daysAgo(100) },
);
T("kyc_checks").push({ id: uid("c4c1"), profile_id: kycProfile.id, check_type: "identity", provider: "Manual", provider_check_id: null, result: "pass", raw_result: null, checked_at: daysAgo(2000) });

const dp = (over) => T("dp_requests").push({ id: uid("d9e0"), contact_id: null, subject_name: null, kind: "access", channel: "email", received_at: dateAgo(10), due_at: dateAgo(-20), completed_at: null, outcome: null, notes: null, created_by: ADMIN, created_at: daysAgo(10), ...over });
// Overdue: received six weeks ago, still open.
dp({ contact_id: contacts[12].id, kind: "access", received_at: dateAgo(44), due_at: dateAgo(14), notes: "Asked for everything we hold, including emails." });
dp({ subject_name: "Former newsletter subscriber (no record found)", kind: "erasure", channel: "post", received_at: dateAgo(38), due_at: dateAgo(8) });
dp({ contact_id: contacts[13].id, kind: "rectification", received_at: dateAgo(6), due_at: dateAgo(-24) });
dp({ contact_id: weak1.id, kind: "objection", received_at: dateAgo(2), due_at: dateAgo(-28), channel: "phone" });
dp({ contact_id: erased.id, kind: "erasure", received_at: dateAgo(120), due_at: dateAgo(90), completed_at: daysAgo(90), outcome: "Erased" });
dp({ contact_id: contacts[14].id, kind: "access", received_at: dateAgo(200), due_at: dateAgo(170), completed_at: daysAgo(185), outcome: "Export sent by email" });
T("dp_breach_log").push(
  { id: uid("db0a"), occurred_at: daysAgo(150), discovered_at: daysAgo(149), description: "A newsletter test was sent to the full TEFAF list instead of the test address.", data_affected: "Names and email addresses", people_affected: 85, likely_risk: "Low", reported_to_ico: false, reported_at: null, subjects_notified: false, actions_taken: "Apology sent; test sends now go to one address only.", created_by: ADMIN, created_at: daysAgo(149) },
);
T("dp_retention_runs").push(
  { id: 1, ran_at: daysAgo(31), triggered_by: "cron", result: { email_events: 3, offer_views: 12, campaign_recipients: 0, enquiries: 1, appointments: 2, unconfirmed_signups: 4, activity_log: 0, ran_at: daysAgo(31) } },
  { id: 2, ran_at: daysAgo(1), triggered_by: "cron", result: { email_events: 0, offer_views: 2, campaign_recipients: 0, enquiries: 0, appointments: 0, unconfirmed_signups: 1, activity_log: 0, ran_at: daysAgo(1) } },
);
const POLICIES = [
  ["email_events", "Email delivery events (opens, clicks, bounces)", 730, "purge", "Legitimate interest: proving delivery and handling complaints; two years"],
  ["offer_views", "Private-offer page views (IP, browser)", 730, "purge", "Legitimate interest: security of private links; two years"],
  ["campaign_recipients", "Newsletter send records per contact", 1095, "purge", "Evidence of PECR compliance for three years after a send"],
  ["enquiries", "Website enquiries", 1095, "purge", "Contract and pre-contract steps; three years after the enquiry"],
  ["appointments", "Appointment bookings", 730, "purge", "Contract; two years after the appointment"],
  ["unconfirmed_signups", "Newsletter sign-ups never confirmed", 30, "purge", "Consent not completed: the record has no basis to stay"],
  ["activity_log", "Studio change history", 2190, "purge", "Accounting and provenance records; six years"],
  ["inactive_contacts", "Contacts with no activity, no consent and no hold", 1825, "review", "Reviewed for deletion after five years, never deleted automatically"],
  ["kyc_records", "AML due-diligence records after the relationship ends", 1825, "review", "MLR 2017 reg. 40: five years, then reviewed for deletion"],
];
for (const [key, label, days, mode, basis] of POLICIES) T("retention_policies").push({ key, label, days, mode, basis, updated_at: daysAgo(200) });

// ------------------------------------------------------ operations, sync, misc

// The panel reads the latest run per kind ("db", "webdav") and flags one
// older than 26 hours: the database is current, the drive copy is stale.
T("backup_runs").push(
  { id: 1, kind: "db", status: "ok", detail: null, size_bytes: 48_201_993, created_at: daysAgo(2, 3) },
  { id: 2, kind: "webdav", status: "ok", detail: null, size_bytes: 21_390_114_816, created_at: daysAgo(3, 4) },
  { id: 3, kind: "db", status: "ok", detail: null, size_bytes: 48_310_552, created_at: daysAgo(1, 3) },
  { id: 4, kind: "webdav", status: "error", detail: "Remote target refused the connection", size_bytes: null, created_at: daysAgo(2, 4) },
  { id: 5, kind: "db", status: "ok", detail: null, size_bytes: 48_402_310, created_at: daysAgo(0, 3) },
);
T("sync_outbox").push(
  ...pieces.slice(0, 7).map((p, i) => ({ id: i + 1, entity_type: "piece", entity_id: p.id, op: "upsert", created_at: daysAgo(0, 9), processed_at: null, claimed_at: null })),
  { id: 8, entity_type: "maker", entity_id: makers[0].id, op: "upsert", created_at: daysAgo(3), processed_at: daysAgo(3), claimed_at: daysAgo(3) },
);
T("sync_config").push({ id: 1, studio_url: "http://localhost:3011", secret: "preview-not-a-secret", updated_at: daysAgo(100) });
T("sanity_sync_state").push(
  ...pieces.filter((p) => p.web_visible).slice(0, 20).map((p) => ({ entity_type: "piece", entity_id: p.id, sanity_doc_id: `work-${p.id}`, status: "ok", error: null, last_pushed_hash: "preview", last_pushed_at: daysAgo(4), updated_at: daysAgo(4) })),
  { entity_type: "piece", entity_id: pieces[4].id, sanity_doc_id: null, status: "error", error: "Image upload timed out", last_pushed_hash: null, last_pushed_at: null, updated_at: daysAgo(1) },
);
T("sanity_assets").push({ storage_path: images[0].storage_path_display, asset_id: "image-preview-1", uploaded_at: daysAgo(30) });

// The FileMaker import's leftovers (migration page).
for (let i = 0; i < 24; i++) {
  const p = pieces[i * 4 % pieces.length];
  T("legacy_filemaker_rows").push({
    id: uid("1e9a"),
    row_number: 1000 + i * 37,
    raw: { "Stock No": p.legacy_stock_number ?? `J${2000 + i}`, Title: p.title, Price: "on request" },
    piece_id: i % 6 === 5 ? null : p.id,
    issues: i % 3 === 0 ? [pick(["price not numeric", "maker not matched", "date unreadable"]), ...(i % 2 ? ["dimensions in inches"] : [])] : [],
    import_batch: "filemaker-2026-07",
    created_at: daysAgo(90),
  });
}
T("legacy_value_mappings").push({ id: uid("1e9b"), field: "Category", raw_value: "Bamboo", mapped_kind: "category", mapped_value: cat.BAM, reviewed: true, notes: null, created_at: daysAgo(90) });

// Empty on purpose; the studio reads them.
for (const t of ["orders", "order_items", "consignment_items", "kyc_documents", "invitations", "piece_embeddings", "offer_views_archive", "exhibitions", "piece_exhibitions", "availability_rules", "crm_interactions_archive"]) T(t);
delete db.offer_views_archive;
delete db.crm_interactions_archive;

// ------------------------------------------------------------------- write

for (const p of [...pieces, ...external]) delete p.__code;
for (const m of makers) delete m.__cats;
T("pieces").push(...pieces);
T("external_pieces").push(...external);

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, "_meta.json"), `${JSON.stringify({ anchor_date: ANCHOR, generated_by: "fixtures/generate.mjs" }, null, 2)}\n`);
for (const [name, rows] of Object.entries(db).sort()) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify(rows, null, 1)}\n`);
}
const summary = Object.entries(db)
  .map(([k, v]) => `${k} ${v.length}`)
  .join(", ");
console.log(`Wrote ${Object.keys(db).length} tables to ${path.relative(process.cwd(), OUT)}: ${summary}`);

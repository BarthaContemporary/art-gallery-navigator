/*
 * The address fields a "Find address" pick fills in (components/
 * address-fields.tsx), pure so it can be tested (address-pick.test.ts).
 *
 * A pick replaces the address: every line comes from the picked place, and a
 * part the place does not have is left empty, never kept from the address it
 * replaces. (Keeping it put a Hong Kong address over the old London postcode,
 * or a house with no flat number under the old "Flat 3", and the autosave
 * stored the mix for the next mailing labels.) An empty line is visible and
 * can be filled in by hand; a stale one reads as right.
 *
 * Line 1 is the street (number and route). A place with no street parts (a
 * Japanese address, which Google gives as districts and block numbers) takes
 * the first part of its formatted address instead, unless that is only the
 * town, postcode or country (a town or a bare postcode was picked).
 *
 * The company is the business name when an establishment was picked, and is
 * otherwise kept: it belongs to the person's work address, not to the street.
 */

export type PlaceParts = Record<string, string>;

export type PickedAddress = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  company: string;
};

export function addressFromPlace(
  parts: PlaceParts,
  place: { establishment: boolean; name?: string | null; formattedAddress?: string | null },
  prevCompany: string,
): PickedAddress {
  const p = (k: string) => (parts[k] ?? "").trim();
  const city = p("postal_town") || p("locality") || p("sublocality") || p("sublocality_level_1");
  const postcode = p("postal_code");
  const country = p("country");

  let line1 = [p("street_number"), p("route")].filter(Boolean).join(" ");
  if (!p("route")) {
    const lead = (place.formattedAddress ?? "").split(",")[0]?.trim() ?? "";
    const same = (a: string, b: string) => a !== "" && a.toLowerCase() === b.toLowerCase();
    const onlyArea =
      !lead ||
      same(lead, city) ||
      same(lead, country) ||
      same(lead, postcode) ||
      same(lead, `${postcode} ${city}`) ||
      same(lead, `${city} ${postcode}`);
    line1 = onlyArea ? "" : lead;
    // No formatted address to go by: the street-level parts Google does give.
    if (!place.formattedAddress) {
      line1 = [p("sublocality_level_2"), p("sublocality_level_3"), p("sublocality_level_4"), p("premise")]
        .filter(Boolean)
        .join("-");
    }
  }

  return {
    line1,
    line2: p("subpremise") || (p("route") ? p("premise") : ""),
    city,
    postcode,
    country,
    company: place.establishment && place.name ? place.name : prevCompany,
  };
}

/** The search text for the map preview, from the address as shown. */
export function mapQuery(v: { line1: string; line2: string; city: string; postcode: string; country: string }): string {
  return [v.line1, v.line2, v.city, v.postcode, v.country].filter(Boolean).join(", ");
}

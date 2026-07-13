/**
 * Proposal logic for the dealer-reviewed value mappings (legacy_value_mappings).
 * These functions only PROPOSE — the dealer reviews the generated CSVs and the
 * reviewed files are what gets imported.
 */

export interface MappingProposal {
  proposed_kind: string;
  proposed_value: string;
  notes: string;
}

/** Known origin regions appearing in the legacy Category/Location columns. */
const REGION_NORMALIZATION: Record<string, string> = {
  japan: "Japan",
  japanese: "Japan",
  india: "India",
  indian: "India",
  "south asia": "South Asia",
  "south east asia": "Southeast Asia",
  "southeast asia": "Southeast Asia",
  pakistan: "Pakistan",
  china: "China",
  chinese: "China",
  korea: "Korea",
  korean: "Korea",
  tibet: "Tibet",
  tibetan: "Tibet",
  nepal: "Nepal",
  burma: "Burma",
  myanmar: "Burma",
  "sri lanka": "Sri Lanka",
  vietnam: "Vietnam",
  thailand: "Thailand",
  himalayas: "Himalayas",
  himalayan: "Himalayas",
};

const REGION_KEYWORDS = Object.keys(REGION_NORMALIZATION);

function normalizeRegion(raw: string): string | null {
  return REGION_NORMALIZATION[raw.trim().toLowerCase()] ?? null;
}

/** Does the value mention a region anywhere (e.g. 'Rajasthan, India')? */
function containsRegionKeyword(raw: string): string | null {
  const lower = raw.toLowerCase();
  for (const kw of REGION_KEYWORDS) {
    if (new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`).test(lower)) {
      return REGION_NORMALIZATION[kw]!;
    }
  }
  return null;
}

/** Category mixes classification codes ('A','C'), regions and sale status. */
export function proposeCategory(raw: string): MappingProposal {
  const t = raw.trim();

  if (/^sold/i.test(t)) {
    const notes: string[] = ["sale status leaked into Category"];
    if (/\?/.test(t)) notes.push("uncertain ('?') — dealer to confirm");
    if (/gift/i.test(t)) notes.push("mentions gift — piece_status 'gifted'?");
    return { proposed_kind: "status", proposed_value: "sold", notes: notes.join("; ") };
  }

  const region = normalizeRegion(t);
  if (region) {
    return {
      proposed_kind: "origin_region",
      proposed_value: region,
      notes: region === t ? "" : `normalized from '${t}'`,
    };
  }

  if (/^[A-Za-z]$/.test(t)) {
    return {
      proposed_kind: "category_code",
      proposed_value: t.toUpperCase(),
      notes: "single-letter legacy classification code",
    };
  }

  const embeddedRegion = containsRegionKeyword(t);
  if (embeddedRegion) {
    return {
      proposed_kind: "origin_region",
      proposed_value: embeddedRegion,
      notes: `region-looking value '${t}'`,
    };
  }

  return { proposed_kind: "unknown", proposed_value: "", notes: "needs dealer review" };
}

/** Location mixes storage codes ('SJ - B2', 'PP', 'Auction') and origin regions. */
export function proposeLocation(raw: string): MappingProposal {
  const t = raw.trim();

  const sj = t.match(/^SJ\s*[-–]?\s*(\w+)$/i);
  if (sj) {
    return {
      proposed_kind: "storage_location",
      proposed_value: `SJ-${sj[1]!.toUpperCase()}`,
      notes: "normalized SJ storage code",
    };
  }
  if (/^st\.?\s*james(?:'?s)?$/i.test(t)) {
    return {
      proposed_kind: "storage_location",
      proposed_value: "SJ",
      notes: "St James gallery",
    };
  }
  if (/^auction$/i.test(t)) {
    return {
      proposed_kind: "storage_location",
      proposed_value: "AUCTION",
      notes: "location type: auction",
    };
  }

  const region = normalizeRegion(t) ?? containsRegionKeyword(t);
  if (region) {
    return {
      proposed_kind: "origin_region",
      proposed_value: normalizeRegion(t) ?? t,
      notes: "origin region misfiled in Location — not a storage location",
    };
  }

  if (/^[A-Z]{1,4}\d{0,3}$/.test(t)) {
    return {
      proposed_kind: "storage_location",
      proposed_value: t.toUpperCase(),
      notes: "short code — assumed storage location",
    };
  }

  return { proposed_kind: "unknown", proposed_value: "", notes: "needs dealer review" };
}

/** Status column → piece_status enum values. */
export function proposeStatus(raw: string): MappingProposal {
  const t = raw.trim().toLowerCase();
  if (/^sold/.test(t)) {
    return {
      proposed_kind: "status",
      proposed_value: "sold",
      notes: /\?/.test(t) || /gift/.test(t) ? "qualified — dealer to confirm" : "",
    };
  }
  const direct: Record<string, string> = {
    "in stock": "in_stock",
    stock: "in_stock",
    reserved: "reserved",
    consigned: "consigned_out",
    "consigned out": "consigned_out",
    "consigned in": "consigned_in",
    gift: "gifted",
    gifted: "gifted",
    returned: "returned",
    "written off": "written_off",
  };
  const value = direct[t];
  if (value) return { proposed_kind: "status", proposed_value: value, notes: "" };
  return { proposed_kind: "unknown", proposed_value: "", notes: "needs dealer review" };
}

/**
 * Published is misused: 'X' means published-on-web, but many values are
 * buyer names / export notes like 'Rose Uniacke (2021)' or
 * 'Alex Davidoff (EXPORT) (2025)'.
 */
export function proposePublished(raw: string): MappingProposal {
  const t = raw.trim();
  if (/^x$/i.test(t)) {
    return {
      proposed_kind: "web_published",
      proposed_value: "true",
      notes: "legacy web-published flag",
    };
  }
  if (/\(\d{4}\)/.test(t) || /export/i.test(t)) {
    const notes: string[] = ["buyer/export note misfiled in Published → provenance"];
    if (/export/i.test(t)) notes.push("mentions EXPORT");
    return { proposed_kind: "buyer_note", proposed_value: t, notes: notes.join("; ") };
  }
  // A bare personal-looking name (two+ capitalised words) is still likely a buyer.
  if (/^[A-ZÀ-Þ][\p{L}.'-]+(?:\s+[A-ZÀ-Þ][\p{L}.'-]+)+$/u.test(t)) {
    return {
      proposed_kind: "buyer_note",
      proposed_value: t,
      notes: "name-looking value — probable buyer",
    };
  }
  return { proposed_kind: "unknown", proposed_value: "", notes: "needs dealer review" };
}

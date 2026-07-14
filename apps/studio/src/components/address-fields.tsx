"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Load the Google Maps JS (Places) script once, shared across instances.
let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (!MAPS_KEY) return Promise.reject(new Error("no key"));
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

type Names = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  type: string;
};

type Values = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  type: string;
};

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const input =
  "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";

const TYPE_OPTIONS: [string, string][] = [
  ["primary_home", "Primary home"],
  ["work", "Work"],
  ["second_home", "Second home"],
];

/**
 * One address block: a type selector, address inputs wired to Google Places
 * autocomplete (fills city/postcode/country from the chosen place), and a
 * greyscale Static Maps preview. Degrades to plain inputs when no Maps key.
 */
export function AddressFields({
  legend,
  names,
  defaults,
}: {
  legend: string;
  names: Names;
  defaults: Partial<Values>;
}) {
  const [v, setV] = useState<Values>({
    line1: defaults.line1 ?? "",
    line2: defaults.line2 ?? "",
    city: defaults.city ?? "",
    postcode: defaults.postcode ?? "",
    country: defaults.country ?? "",
    type: defaults.type ?? "primary_home",
  });
  const line1Ref = useRef<HTMLInputElement>(null);
  const [mapBroken, setMapBroken] = useState(false);

  useEffect(() => {
    if (!MAPS_KEY || !line1Ref.current) return;
    let ac: any;
    loadMaps()
      .then(() => {
        const g = (window as any).google;
        if (!g?.maps?.places || !line1Ref.current) return;
        ac = new g.maps.places.Autocomplete(line1Ref.current, {
          fields: ["address_components"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const parts: Record<string, string> = {};
          for (const c of place.address_components ?? []) {
            for (const t of c.types) parts[t] = c.long_name;
          }
          setV((prev) => ({
            ...prev,
            line1: [parts.street_number, parts.route].filter(Boolean).join(" ") || prev.line1,
            line2: parts.subpremise || parts.premise || prev.line2,
            city: parts.postal_town || parts.locality || parts.sublocality || prev.city,
            postcode: parts.postal_code || prev.postcode,
            country: parts.country || prev.country,
          }));
        });
      })
      .catch(() => {});
    return () => {
      if (ac && (window as any).google?.maps?.event)
        (window as any).google.maps.event.clearInstanceListeners(ac);
    };
  }, []);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  const query = [v.line1, v.line2, v.city, v.postcode, v.country]
    .filter(Boolean)
    .join(", ");
  const mapSrc =
    MAPS_KEY && query
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=14&size=320x150&scale=2&markers=color:0x555555%7C${encodeURIComponent(query)}&style=feature:all%7Celement:all%7Csaturation:-100&style=feature:poi%7Cvisibility:off&key=${MAPS_KEY}`
      : null;

  // A rejected Static Maps request (API not enabled, referrer, billing) must
  // never surface as a broken-image "!". Hide the preview instead; it retries
  // whenever the address changes.
  useEffect(() => setMapBroken(false), [mapSrc]);

  return (
    <fieldset className="sm:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <legend className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          {legend}
        </legend>
        <label className="text-[11px] text-ink-faint">
          Type
          <select
            name={names.type}
            value={v.type}
            onChange={(e) => setV((p) => ({ ...p, type: e.target.value }))}
            className="ml-2 rounded-lg border border-line-control bg-control px-2 py-1 text-[12.5px] text-ink-body"
          >
            {TYPE_OPTIONS.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Address line 1{MAPS_KEY ? " (start typing to search)" : ""}
          <input
            ref={line1Ref}
            name={names.line1}
            value={v.line1}
            onChange={set("line1")}
            autoComplete="off"
            className={input}
          />
        </label>
        <label className={label}>
          Address line 2
          <input name={names.line2} value={v.line2} onChange={set("line2")} className={input} />
        </label>
        <label className={label}>
          City
          <input name={names.city} value={v.city} onChange={set("city")} className={input} />
        </label>
        <label className={label}>
          Postcode
          <input name={names.postcode} value={v.postcode} onChange={set("postcode")} className={input} />
        </label>
        <label className={label}>
          Country
          <input name={names.country} value={v.country} onChange={set("country")} className={input} />
        </label>
        {mapSrc && !mapBroken ? (
          <div className="self-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapSrc}
              alt={`Map of ${query}`}
              onError={() => setMapBroken(true)}
              className="h-[75px] w-full rounded-lg border border-line-soft object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div />
        )}
      </div>
    </fieldset>
  );
}

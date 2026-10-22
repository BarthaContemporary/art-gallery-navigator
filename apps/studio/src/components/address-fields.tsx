"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field } from "./ui/field";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Load the Google Maps JS API once via Google's official inline bootstrap
// loader, which defines google.maps.importLibrary synchronously (a plain
// <script loading=async> tag does NOT reliably expose importLibrary at onload).
let mapsPromise: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (!MAPS_KEY) return Promise.reject(new Error("no key"));
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<any>((resolve, reject) => {
    try {
      // Bootstrap loader (from Google's docs), inlined and typed.
      ((g: Record<string, string>) => {
        let h: Promise<void> | undefined;
        const c = "google";
        const b: any = (w[c] = w[c] || {});
        const d: any = (b.maps = b.maps || {});
        const r = new Set<string>();
        const e = new URLSearchParams();
        const u = () =>
          h ||
          (h = new Promise<void>((res, rej) => {
            const a = document.createElement("script");
            e.set("libraries", [...r].join(","));
            for (const k in g) {
              const val = g[k];
              if (val !== undefined)
                e.set(k.replace(/[A-Z]/g, (t) => "_" + t.toLowerCase()), val);
            }
            e.set("callback", c + ".maps.__ib__");
            a.src = "https://maps.googleapis.com/maps/api/js?" + e;
            d.__ib__ = res;
            a.onerror = () => {
              h = undefined;
              rej(new Error("could not load"));
            };
            document.head.append(a);
          }));
        if (!d.importLibrary)
          d.importLibrary = (f: string, ...n: unknown[]) =>
            r.add(f) && u().then(() => d.importLibrary(f, ...n));
      })({ key: MAPS_KEY, v: "weekly" });
      if (w.google?.maps?.importLibrary) resolve(w.google);
      else reject(new Error("bootstrap failed"));
    } catch (err) {
      reject(err);
    }
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
  company: string;
};

type Values = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country: string;
  type: string;
  company: string;
};

const TYPE_OPTIONS: [string, string][] = [
  ["primary_home", "Primary home"],
  ["work", "Work"],
  ["second_home", "Second home"],
];

export function AddressFields({
  legend,
  names,
  defaults,
  onChange,
}: {
  legend: string;
  names: Names;
  defaults: Partial<Values>;
  onChange?: () => void;
}) {
  const [v, setV] = useState<Values>({
    line1: defaults.line1 ?? "",
    line2: defaults.line2 ?? "",
    city: defaults.city ?? "",
    postcode: defaults.postcode ?? "",
    country: defaults.country ?? "",
    type: defaults.type ?? "primary_home",
    company: defaults.company ?? "",
  });
  const acHostRef = useRef<HTMLDivElement>(null);
  const [mapBroken, setMapBroken] = useState(false);
  const [mapsMsg, setMapsMsg] = useState<string | null>(null);

  // Google Places Autocomplete (new PlaceAutocompleteElement — the only variant
  // available to keys created after March 2025). Everything is wrapped so a
  // missing/blocked API never throws into React.
  useEffect(() => {
    if (!MAPS_KEY || !acHostRef.current) return;
    let el: any;
    let cancelled = false;
    loadMaps()
      .then(async (g) => {
        const places = await g.maps.importLibrary("places");
        if (cancelled || !acHostRef.current) return;
        if (!places?.PlaceAutocompleteElement) {
          setMapsMsg(
            "Address lookup is unavailable. Enable the Places API (New) for this key in Google Cloud.",
          );
          return;
        }
        setMapsMsg(null);
        el = new places.PlaceAutocompleteElement();
        // Blend the widget into our form controls: fill the styled wrapper,
        // drop its own chrome and inherit our typeface/colour.
        el.style.width = "100%";
        try {
          // Force a light rendering (the widget otherwise inherits a dark
          // color-scheme on focus → black field / illegible grey text), inherit
          // our typeface, and keep it the same height as the other inputs.
          el.style.colorScheme = "light";
          el.style.background = "transparent";
          el.style.border = "none";
          el.style.fontFamily = "inherit";
          el.style.fontSize = "13.5px";
          el.style.color = "var(--jvb-ink)";
        } catch {
          /* older widget builds may not expose these */
        }
        acHostRef.current.appendChild(el);
        el.addEventListener("gmp-select", async (e: any) => {
          try {
            const place = e.placePrediction.toPlace();
            await place.fetchFields({
              fields: ["addressComponents", "displayName", "types"],
            });
            const parts: Record<string, string> = {};
            for (const c of place.addressComponents ?? []) {
              for (const t of c.types) parts[t] = c.longText ?? c.shortText ?? "";
            }
            // If the picked place is a business/establishment, use its name to
            // auto-fill the company field.
            const isEstablishment = (place.types ?? []).includes("establishment");
            const businessName =
              isEstablishment && typeof place.displayName === "string"
                ? place.displayName
                : "";
            setV((prev) => ({
              ...prev,
              company: businessName || prev.company,
              line1: [parts.street_number, parts.route].filter(Boolean).join(" ") || prev.line1,
              line2: parts.subpremise || parts.premise || prev.line2,
              city: parts.postal_town || parts.locality || parts.sublocality || prev.city,
              postcode: parts.postal_code || prev.postcode,
              country: parts.country || prev.country,
            }));
          } catch {
            /* ignore selection errors */
          }
        });
      })
      .catch((err) => {
        if (cancelled) return;
        // Google logs its own precise `…MapError` to the console; surface the
        // most common non-obvious causes and point there.
        console.error("[address lookup] Google Maps JS failed to load:", err);
        setMapsMsg(
          "Address lookup couldn’t load. Most likely the key’s API restrictions don’t allow the Maps JavaScript API (enabling it for the project isn’t enough: it must be in the key’s allowed APIs, alongside Places API New). Also check billing, and that no ad blocker is blocking maps.googleapis.com. The browser console shows Google’s exact error.",
        );
      });
    return () => {
      cancelled = true;
      if (el?.remove) el.remove();
    };
  }, []);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  const query = [v.line1, v.line2, v.city, v.postcode, v.country]
    .filter(Boolean)
    .join(", ");
  const mapSrc =
    MAPS_KEY && query
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=15&size=640x260&scale=2&markers=color:0x555555%7C${encodeURIComponent(query)}&style=saturation:-100&style=feature:poi%7Cvisibility:off&key=${MAPS_KEY}`
      : null;
  useEffect(() => setMapBroken(false), [mapSrc]);

  // Notify the parent editor on any change (incl. autocomplete fills). Skip mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) onChange?.();
    else mounted.current = true;
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWork = v.type === "work";
  const uid = useId();
  const fid = (k: keyof Names) => `${uid}-${k}`;

  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="pt-2 text-[13px] font-semibold leading-[1.45] text-ink">{legend}</legend>

      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <Field id={fid("type")} label="Address type">
          <select
            id={fid("type")}
            name={names.type}
            defaultValue={v.type}
            onChange={(e) => setV((p) => ({ ...p, type: e.target.value }))}
            className="field"
          >
            {TYPE_OPTIONS.map(([val, l]) => (
              <option key={val} value={val}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        {/* Company name: auto-filled when a business is picked from the
            search. Shown for work addresses; kept mounted (hidden otherwise)
            so its value is preserved and always submitted. */}
        {/* Off a work address the cell stays (invisible) beside the type, so
            the address lines keep their two-up rows; one column needs no
            placeholder. */}
        <div className={isWork ? "min-w-0" : "invisible max-sm:hidden"}>
          <Field id={fid("company")} label="Company name">
            <input
              id={fid("company")}
              name={names.company}
              value={v.company}
              onChange={set("company")}
              placeholder="Christie’s"
              className="field"
            />
          </Field>
        </div>

        {MAPS_KEY ? (
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <span className="label">Find address</span>
            <div
              ref={acHostRef}
              className="field-box flex min-h-[var(--jvb-control-h)] items-center px-2 [color-scheme:light] [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:bg-transparent"
            />
            {mapsMsg ? <p className="text-[12px] leading-[1.4] text-meta">{mapsMsg}</p> : null}
          </div>
        ) : null}

        <Field id={fid("line1")} label="Address line 1">
          <input id={fid("line1")} name={names.line1} value={v.line1} onChange={set("line1")} className="field" />
        </Field>
        <Field id={fid("line2")} label="Address line 2">
          <input id={fid("line2")} name={names.line2} value={v.line2} onChange={set("line2")} className="field" />
        </Field>
        <Field id={fid("city")} label="City">
          <input id={fid("city")} name={names.city} value={v.city} onChange={set("city")} className="field" />
        </Field>
        <Field id={fid("postcode")} label="Postcode">
          <input
            id={fid("postcode")}
            name={names.postcode}
            value={v.postcode}
            onChange={set("postcode")}
            className="field"
          />
        </Field>
        <Field id={fid("country")} label="Country" className="sm:col-span-2">
          <input
            id={fid("country")}
            name={names.country}
            value={v.country}
            onChange={set("country")}
            className="field"
          />
        </Field>
      </div>

      {/* Greyscale map preview, full width. */}
      {mapSrc && !mapBroken ? (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapSrc}
            alt={`Map of ${query}`}
            onError={() => setMapBroken(true)}
            className="h-[220px] w-full border border-rule object-cover"
            loading="lazy"
          />
        </div>
      ) : query && mapBroken ? (
        <p className="mt-3 text-[12px] leading-[1.4] text-meta">
          Map preview unavailable. Enable the Maps Static API for this key.
        </p>
      ) : null}
    </fieldset>
  );
}

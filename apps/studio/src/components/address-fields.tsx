"use client";

import { useEffect, useRef, useState } from "react";

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

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const input =
  "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";

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
            "Address lookup unavailable — enable the “Places API (New)” for this key in Google Cloud.",
          );
          return;
        }
        setMapsMsg(null);
        el = new places.PlaceAutocompleteElement();
        // Blend the widget into our form controls: fill the styled wrapper,
        // drop its own chrome and inherit our typeface/colour.
        el.style.width = "100%";
        try {
          el.style.background = "transparent";
          el.style.border = "none";
          el.style.fontFamily = "inherit";
          el.style.fontSize = "13.5px";
          el.style.color = "var(--jvb-ink-body)";
        } catch {
          /* older widget builds may not expose these */
        }
        acHostRef.current.appendChild(el);
        el.addEventListener("gmp-select", async (e: any) => {
          try {
            const place = e.placePrediction.toPlace();
            await place.fetchFields({ fields: ["addressComponents"] });
            const parts: Record<string, string> = {};
            for (const c of place.addressComponents ?? []) {
              for (const t of c.types) parts[t] = c.longText ?? c.shortText ?? "";
            }
            setV((prev) => ({
              ...prev,
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
          "Address lookup couldn’t load. Most likely the key’s API restrictions don’t allow the Maps JavaScript API (enabling it project-wide isn’t enough — it must be in the key’s allowed-APIs list, alongside Places API New). Also check billing, and that no ad-blocker is blocking maps.googleapis.com. The browser console shows Google’s exact error.",
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
            defaultValue={v.type}
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

      {/* Company name — for work addresses. Kept mounted (hidden when not work) so
          its value is preserved and always submitted with the form. */}
      <label className={`${label} mt-2 ${isWork ? "block" : "hidden"}`}>
        Company name
        <input
          name={names.company}
          value={v.company}
          onChange={set("company")}
          placeholder="e.g. Christie’s"
          className={input}
        />
      </label>

      {MAPS_KEY ? (
        <div className="mt-2">
          <span className={label}>Find address</span>
          <div
            ref={acHostRef}
            className="mt-1 rounded-lg border border-line-control bg-control px-2.5 py-1.5 [&_gmp-place-autocomplete]:w-full [&_gmp-place-autocomplete]:bg-transparent"
          />
          {mapsMsg ? (
            <p className="mt-1 text-[11.5px] text-ink-soft">{mapsMsg}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Address line 1
          <input name={names.line1} value={v.line1} onChange={set("line1")} className={input} />
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
        <label className={`${label} sm:col-span-2`}>
          Country
          <input name={names.country} value={v.country} onChange={set("country")} className={input} />
        </label>
      </div>

      {/* Greyscale map preview — full width, larger. */}
      {mapSrc && !mapBroken ? (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapSrc}
            alt={`Map of ${query}`}
            onError={() => setMapBroken(true)}
            className="h-[220px] w-full rounded-lg border border-line-soft object-cover"
            loading="lazy"
          />
        </div>
      ) : query && mapBroken ? (
        <p className="mt-3 text-[11px] text-ink-soft">
          Map preview unavailable — enable the “Maps Static API” for this key.
        </p>
      ) : null}
    </fieldset>
  );
}
